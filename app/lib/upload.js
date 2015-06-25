// upload a survey
var jsSHA = require('sha1');
var uuid = require('uuid');

Ti.App.addEventListener("app:dataBaseError", function(e) {
	Titanium.API.error("Database error (upload): " + e.error);
});

function preparePhotos(guid) {
	var authLevel = Ti.App.Properties.getString('auth_level');
	
	if ((authLevel == 1) || (authLevel == 9)) { 
		try{
			Ti.App.fireEvent("app:uploadStarted");
			
			var db = Ti.Database.open('ltemaDB');
			var mediaIDs = [];
			var transects = db.execute('SELECT transect_guid, media_id FROM transect WHERE site_survey_guid = ?', guid);
				
			// Copy and associate any existing transects media
			while (transects.isValidRow()) {
				var transectGUID = transects.fieldByName('transect_guid');
				var transectMediaID = transects.fieldByName('media_id');
				
				if (transectMediaID) {
					mediaIDs.push(transectMediaID);
				}
				
				// Get any plots associated with the transect
				var plots = db.execute('SELECT plot_guid, media_id FROM plot WHERE transect_guid = ?', transectGUID);
				
				// Copy and associate any existing plots media
				while (plots.isValidRow()) {
					var plotMediaID = plots.fieldByName('media_id');
					var plotGUID = plots.fieldByName('plot_guid');
					
					if (plotMediaID) {
						mediaIDs.push(plotMediaID);	
					}
									
					// Get any plot observations associated with the plot
					var observations = db.execute('SELECT media_id FROM plot_observation WHERE plot_guid = ?', plotGUID);
					
					// Copy and associate any existing plot observations media
					while (observations.isValidRow()){
						var observationMediaID = observations.fieldByName('media_id');
					
						if (observationMediaID) {
							mediaIDs.push(observationMediaID);
						}
						
						observations.next();
					}	
					plots.next();
				}
				transects.next();
			}
			
			var uploadMedia = [];
			for (var i = 0, m = mediaIDs.length; i < m; i++) {
				if (mediaIDs[i] === null) {
					continue;
				}
				
				var mediaResults = db.execute('SELECT * FROM media WHERE media_id = ?', mediaIDs[i]);
				
				var mediaName = mediaResults.fieldByName('media_name');
				
				if (!mediaName) {
					continue;
				}
				
				var cloudMediaID = mediaResults.fieldByName('cloud_media_id');
				var mediaID = mediaResults.fieldByName('media_id');
							
				var results = {'media_id':mediaID, 'media_name':mediaName, 'cloud_media_id':cloudMediaID};
				
				uploadMedia.push(results);
			}
	
			//Upload all un-uploaded photos to Imgur
			mediaUpload(uploadMedia, guid);
	
		} catch(e) {
			uploadMedia = undefined;
			var errorMessage = e.message;
			Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
			Ti.App.fireEvent("app:uploadFailed");
		} finally{
			db.close();
		}
		
	} else {
		alert('Please Login to upload a Survey');
	}
}

function mediaUpload(media, guid){
	//go through media looking for object without a cloud media id
	var image = null;
	for(var i = 0; i < media.length; i++){
		if(media[i].cloud_media_id === null){
			image = i;
			break;
		}
	}
	//no images are left to upload found and select protocol is
	if(image === null){
		selectProtocol(guid);
	}
	//otherwise an image is found and that image is then uploaded
	else{
		//Imgur API key
		var api_key = Ti.App.Properties.getString('api_key');
		//Get info on this medias survey
		try {
			var db = Ti.Database.open('ltemaDB');
			var dirInfo = db.execute('SELECT s.year, p.protocol_name, prk.park_name \
							FROM site_survey s, protocol p, park prk \
							WHERE s.protocol_id = p.protocol_id \
							AND s.park_id = prk.park_id \
							AND site_survey_guid = ?', guid);
							
			var year = dirInfo.fieldByName('year');
			var protocolName = dirInfo.fieldByName('protocol_name');
			var parkName = dirInfo.fieldByName('park_name');
			
		} catch(e) {
			var errorMessage = e.message;
			Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
			Ti.App.fireEvent("app:uploadFailed");
			
		} finally {
			db.close();
		}
		
		//Grab the image record being worked on
		var imageRecord = media[image]; 
		
		//Get a the photo as a string from the filesystem
		var dir = year + ' - ' + protocolName + ' - ' + parkName;
		var imageDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
		var file = Ti.Filesystem.getFile(imageDir.resolve(), imageRecord.media_name);
		var photo = Titanium.Utils.base64encode(file.read());
		
		//Remove the file from memory
		file = null;
		
		//Imgur upload endpoint
		var url = 'https://api.imgur.com/3/upload';
		
		//Setup HTTP Client
		if ( Titanium.Network.online ) {
			var xhr = Titanium.Network.createHTTPClient({
				onload : function(e) {
					try{
						//Get the ID back from Imgur
						var response = JSON.parse(this.responseData);
						var photoID = response.data.id;
						media[image].cloud_media_id = photoID;
						
						var db = Ti.Database.open('ltemaDB');
						db.execute( 'UPDATE media SET cloud_media_id = ? WHERE media_id = ?', photoID, media[image].media_id);
						media.splice(image, 1);
						
					} catch(e) {
						var errorMessage = e.message;
						Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
						
					} finally {
						db.close();
						mediaUpload(media, guid);
					}
				},
				onerror : function(e) {
					mediaUpload(media, guid);
					console.log('Something bad happened: {HTTPStatusCode: ' + this.status + '}');
				},
				timeout : 60000
			});
			
			//Open the connection
			xhr.open('POST', url);
			//Setup the connection headers
			xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			xhr.setRequestHeader('Authorization', 'Client-ID ' + api_key);
			//Send the photo
			xhr.send(photo);
		} else {
		    file_obj.error = 'no internet';
            fn_end(file_obj);
        }
	}
}

function selectProtocol (guid){
	//Determine the protocol of the survey being uploaded
	try{
		var db = Ti.Database.open('ltemaDB');
		
		//Get park and protocol names
		var surveyMeta = db.execute('SELECT pr.protocol_name ' +
									 'FROM protocol pr, site_survey su ' +
									 'WHERE pr.protocol_id = su.protocol_id ' +
									 'AND su.site_survey_guid = ?', guid);

		var protocol = surveyMeta.fieldByName('protocol_name');
		
		//Form data for the given protocol
		switch(protocol){
			case 'Alpine':
			case 'Grassland':
				formAlpineGrasslandJSON(guid, uploadJSON);
				break;
			/*case 'Intertidal':
				formIntertidalJSON();
				break;*/
			default:
				console.log('ERROR: Given protocol does not support upload.');
				break;
		}
	}
	catch(e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		Ti.App.fireEvent("app:uploadFailed");
	}
	finally{
		db.close();
	}
}

//Create a JSON object representing an alpine or grassland survey
//and then serialize it
function formAlpineGrasslandJSON(guid, callback){
	try{
		var callbackName = callback.name;
		
		var db = Ti.Database.open('ltemaDB');
	
		//Query - Select metadata for the survey being uploaded
		var metaRows = db.execute( 'SELECT * FROM site_survey WHERE site_survey_guid = ?', guid);

		var year = new Date();
		var survey = {
			transects : [],
			plots : [],
			plot_observations : [],
			media : [],
			survey_meta : {
				site_survey_guid : guid,
				protocol : metaRows.fieldByName('protocol_id'),
				park : metaRows.fieldByName('park_id'),
				version_no : metaRows.fieldByName('version_no'),
				date_surveyed : year.toISOString()
			}
		};
		var mediaIDs = [];

		// start building survey and mediaIDs objects
		var transectRows = db.execute( 'SELECT * FROM transect WHERE site_survey_guid = ?', guid);
		
		while(transectRows.isValidRow()){
			var transect = {
				transect_guid: transectRows.fieldByName('transect_guid'),
				transect_name: transectRows.fieldByName('transect_name'),
				surveyor: transectRows.fieldByName('surveyor'),
				other_surveyors: transectRows.fieldByName('other_surveyors'),
				plot_distance: transectRows.fieldByName('plot_distance'),
				stake_orientation: transectRows.fieldByName('stake_orientation'),
				utm_zone: transectRows.fieldByName('utm_zone'),
				utm_easting: transectRows.fieldByName('utm_easting'),
				utm_northing: transectRows.fieldByName('utm_northing'),
				comments: transectRows.fieldByName('comments'),
				site_survey_guid: transectRows.fieldByName('site_survey_guid'),
				media_id: transectRows.fieldByName('media_id')
			};
			mediaIDs.push(transect.media_id);
			survey.transects.push(transect);

			var plotRows = db.execute('SELECT * FROM plot WHERE transect_guid = ?', transect.transect_guid);
			
			while(plotRows.isValidRow()){
				var plot = {
					plot_guid: plotRows.fieldByName('plot_guid'),
					plot_name: plotRows.fieldByName('plot_name'),
					utm_zone: plotRows.fieldByName('utm_zone'),
					utm_northing: plotRows.fieldByName('utm_northing'),
					utm_easting: plotRows.fieldByName('utm_easting'),
					utc: plotRows.fieldByName('utc'),
					stake_deviation: plotRows.fieldByName('stake_deviation'),
					distance_deviation: plotRows.fieldByName('distance_deviation'),
					transect_guid: plotRows.fieldByName('transect_guid'),
					media_id: plotRows.fieldByName('media_id'),
					comments: plotRows.fieldByName('comments')
				};
				mediaIDs.push(plot.media_id);
				survey.plots.push(plot);

				var observationRows = db.execute('SELECT * FROM plot_observation WHERE plot_guid = ?', plot.plot_guid); 
				
				while(observationRows.isValidRow()){
					var observation = {
						plot_observation_guid: observationRows.fieldByName('plot_observation_guid'),
						observation: observationRows.fieldByName('observation'),
						ground_cover: observationRows.fieldByName('ground_cover'),
						count: observationRows.fieldByName('count'),
						comments: observationRows.fieldByName('comments'),
						plot_guid: observationRows.fieldByName('plot_guid'),
						media_id: observationRows.fieldByName('media_id'),
						species_code: observationRows.fieldByName('species_code')
					};
					mediaIDs.push(observation.media_id);
					survey.plot_observations.push(observation);
					observationRows.next();
				}
				plotRows.next();
			}
			transectRows.next();
		}

		// query for each media row associated with this survey, then add to survey object
		for (var i = 0, m = mediaIDs.length; i < m; i++) {
			var mediaInfo = db.execute('SELECT * FROM media WHERE media_id = ?', mediaIDs[i]);
			
			var media = {
				media_id: mediaInfo.fieldByName('media_id'),
				media_name: mediaInfo.fieldByName('media_name'),
				cloud_media_id: mediaInfo.fieldByName('cloud_media_id')
			};
			survey.media.push(media);
		}

		callback(survey, guid);

	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		Ti.App.fireEvent("app:uploadFailed");
	} finally{
		db.close();
	}
}

/*
//Create a JSON object representing an intertidal survey
//and then serialize it
function formIntertidalJSON(){
	
}
*/

//Push a survey object to the cloud using its guid
function uploadJSON(survey, guid) {
	try{
		
		var url = 'https://capstone-ltemac.herokuapp.com/surveys';
		
		var httpClient = Ti.Network.createHTTPClient();
		httpClient.open("POST", url);
		httpClient.setRequestHeader('secret', Ti.App.Properties.getString('secret'));
		httpClient.setRequestHeader('Content-Type', 'application/json');

		httpClient.onload = function() {
			if (this.status === 200) {
				Ti.App.fireEvent("app:uploadFinished");
			} else {
				Ti.App.fireEvent("app:uploadFailed");
			}
			
		};
		httpClient.onerror = function(e) {
			console.log('status: ' + this.status + ' message: ' + e.message);
			Ti.App.fireEvent("app:uploadFailed");
		};
		
		httpClient.send(
			JSON.stringify({
				guid: survey.survey_meta.site_survey_guid,
				park: survey.survey_meta.park,
				protocol: survey.survey_meta.protocol,
				survey_data: survey,
				date_surveyed: survey.survey_meta.date_surveyed,
				version_no: survey.survey_meta.version_no
			})
		);
		
	} catch(e){
		var errorMessage = e.message;
		console.log('error in authentication function: ' + errorMessage);
		Ti.App.fireEvent("app:uploadFailed");
	}
}

exports.uploadSurvey = preparePhotos;
exports.getExportData = formAlpineGrasslandJSON;
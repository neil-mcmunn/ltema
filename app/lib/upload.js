// upload a survey
var sha1 = require('sha1');
var uuid = require('uuid');
var OAuthSig = require('oauth-signature');

Ti.App.addEventListener("app:dataBaseError", function(e) {
	//TODO: handle a database error for the app
	Titanium.API.error("Database error: " + e.error);
});

function preparePhotos(guid) {
	try{
		var db = Ti.Database.open('ltemaDB');
		
		//Get park and protocol names
		var surveyMeta = db.execute('SELECT pa.park_id, pa.park_name, pr.protocol_id, pr.protocol_name' +
									 'FORM park pa, protocol pr, site_survey su' +
									 'WHERE pa.park_id = su.park_id' +
									 'AND pr.protocol_id = su.park_id' +
									 'AND su.site_survey_guid = ?', guid);

		var park = surveyMeta.fieldByName('park_name');

		var uploadMedia = [];
		var transects = db.execute('SELECT transect_guid, media_id FROM transect WHERE site_survey_guid = ?', guid);
			
		// Copy and associate any existing transects media
		while (transects.isValidRow()) {
			var transectGUID = transects.fieldByName('transect_guid');
			var transectMediaID = transects.fieldByName('media_id');
			uploadMedia.push(transectMediaID);
			
			// Get any plots associated with the transect
			var plots = db.execute('SELECT plot_guid, media_id FROM plot WHERE transect_guid = ?', transectGUID);
			
			// Copy and associate any existing plots media
			while (plots.isValidRow()) {
				var plotMediaID = plots.fieldByName('media_id');
				var plotGUID = plots.fieldByName('plot_guid');
				uploadMedia.push(plotMediaID);
				
				// Get any plot observations associated with the plot
				var observations = db.execute('SELECT media_id FROM plot_observation WHERE plot_guid = ?', plotGUID);
				
				// Copy and associate any existing plot observations media
				while (observations.isValidRow()){
					var observationMediaID = observations.fieldByName('media_id');
					uploadMedia.push(observationMediaID);
					
					observations.next();
				}	
				plots.next();
			}
			transects.next();
		}


		//Upload all un-uploaded photos to flickr
		uploadPhotos(uploadMedia, guid, selectProtocol);

	} catch(e) {
		uploadMedia = undefined;
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally{
		db.close();
	}

	
}

function uploadPhotos (media, guid, callback){
	for(var n = 0; n <= media.length; n++){
		//Get a photo as a string from the filesystem
		var file = Ti.Filesystem.getFile(Ti.Filesystem.resourcesDirectory, media[n].name);
		var blob = file.read();
		
		//Base64 encode the file
		var photo = Titanium.Utils.base64encode(blob.text);

		//Remove the file from memory
		file = null;
		blob = null;

		//Create a signature
		var url = 'https://up.flickr.com/services/upload/';

		//DO: Grab these from the cloud instead of hardcoding
		//access token
		var access_token = Ti.App.Properties.getString('access_token');
		var access_secret = Ti.App.Properties.getString('access_secret');
		
		var consumer_key = Ti.App.Properties.getString('consumer_key');
		var consumer_secret = Ti.App.Properties.getString('consumer_secret');

		var timestamp = Date.now();
		var nonce = uuid.generateUUID();

		var parameters = {
			hidden: 2,
			oauth_consumer_key: consumer_key,
			oauth_signature_method: 'HMAC-SHA1',
			oauth_token: access_token,
			oauth_timestamp: timestamp,
			ouath_nonce: nonce,
			oauth_version:'1.0'
		};

		//Build the oauth_signature and hash it with HMAC-SHA1 & Base64 encoding
		var signature = createSignature(parameters, url);
		var shaObj = new jsSHA(signature, 'TEXT')
		var hmac = shaObj.getHMAC(key, 'TEXT', 'SHA-1', 'B64');
		console.log(hmac);
		signature = hmac;

		parameters.oauth_signature = signature
		parameters.photo = photo;

		var xhr = Titanium.Network.createHTTPClient({
			onload : function(e) {
				try{
					var xml = this.responseXML;
					var photoID = xml.getAttribute('photoid');
					var db = Ti.Database.open('ltemaDB');
					var rows = db.execute( 'UPDATE media\
											SET flickr_id = ?\
											WHERE media_id = ?', photoID, media[n].flickrID); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT
				}
				catch(e) {
					var errorMessage = e.message;
					Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
				}
				finally{
					db.close();
					if(n === media.length){
						callback(guid);
					}
				}
			},
			
			onerror : function(e) {
				//handle errors
			},
			timeout : 30000
		});

		xhr.open('POST', url);
		xhr.send({
			photo: photo,
			hidden: parameters.hidden,
			oauth_signature: signature,
			oauth_consumer_key: consumer_key,
			oauth_signature_method: 'HMAC-SHA1',
			oauth_token: access_token,
			oauth_timestamp: timestamp,
			ouath_nonce: nonce,
			oauth_version:'1.0'
		});

	}
}

function selectProtocol (guid){
	//Determine the protocol of the survey being uploaded
	try{
		var db = Ti.Database.open('ltemaDB');
		
		//Get park and protocol names
		var surveyMeta = db.execute('SELECT pr.protocol_name' +
									 'FORM protocol pr, site_survey su' +
									 'WHERE pr.protocol_id = su.protocol_id' +
									 'AND su.site_survey_guid = ?', guid);

		var protocol = surveyMeta.fieldByName('protocol_name');
	}
	catch(e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	}
	finally{
		db.close();
	}

	//Form data for the given protocol
	switch(protocol){
		case 'Alpine':
		case 'Grassland':
			formAlpineGrasslandJSON(guid);
			break;
		/*case 'Intertidal':
			formIntertidalJSON();
			break;*/
		default:
			console.log('ERROR: Given protocol does not support upload.');
			break;
	}
	
	//POST data to cloud
}

//Create a JSON object representing an alpine or grassland survey
//and then serialize it
function formAlpineGrasslandJSON(guid){
	uploadPhotos(siteName);

	try{
		var db = Ti.Database.open('ltemaDB');
	
		//Query - Select metadata for the survey being uploaded
		var metaRows = db.execute( 'SELECT site_survey_guid, year, protocol_id, park_id' +
								'FROM site_survey' +
								'WHERE site_survey_guid ?', guid);

		var survey = {
			transects : [],
			plots : [],
			plot_observations : [],
			media : [],
			survey_meta : {
				site_survey_guid : metaRows.fieldByName('site_survey_guid'),
				year : metaRows.fieldByName('year'),
				protocol_id : metaRows.fieldByName('protocol_id'),
				park_id : metaRows.fieldByName('park_id')
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
			transectRows.next();

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
					comment: plotRows.fieldByName('comment')
				};
				mediaIDs.push(plot.media_id);
				survey.plots.push(plot);
				plotRows.next();

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
			}
		}

		// query for each media row associated with this survey, then add to survey object
		for (var i = 0, m = mediaIDs.length; i < m; i++) {
			var mediaInfo = db.execute('SELECT * FROM media WHERE media_id = ?', mediaIDs[i]);
			
			var media = {
				media_id: mediaInfo.fieldByName('media_id'),
				media_name: mediaInfo.fieldByName('media_name'),
				flickr_id: mediaInfo.fieldByName('flickr_id')
			};
			survey.media.push(media);
		}

		uploadJSON(survey, guid);

	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
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
				Ti.API.debug("Upload Successful: " + this.responseData);
			} else {
				alert('Upload Failed: ' + this.status);
			}
		};
		httpClient.onerror = function(e) {
			Ti.API.debug("STATUS: " + this.status);
			Ti.API.debug("TEXT:   " + this.responseText);
			Ti.API.debug("ERROR:  " + e.error);
		};
		var currentDate = new Date();
		var now = currentDate.toISOString();

		httpClient.send(
				JSON.stringify(
					{
						site_survey_guid: survey.survey_meta.site_survey_guid,
						survey_data: survey,
						date_surveyed: now,
						version_no: survey.survey_meta.version_no
					}
				)
		);
	}
	catch(e){
		var errorMessage = e.message;
		console.log('error in authentication function: ' + errorMessage);
	}
}

//Assess if all the propertiees of an object have been assigned
function varsAssigned(object){
	for (var prop in object){
		if(prop === undefined){
			return false;
		}
	}

	return true;
}

function createSignature(params, url){
	function printParameters(params){
		//var params = params || {one:1,two:2,three:3};

		var keys = Object.getOwnPropertyNames(params).sort();

		//Generate a string for each key-value pair
		var pairs = [];
		for(var key in keys){
			pairs.push(keys[key] + '=' + params[keys[key]]);
		}

		params = '';

		//Combine all key-value pairs into a single string
		for(var pair in pairs){
			params = params + pairs[pair] + '&';
		}
		//Remove the extra "&" from the above loop
		params = params.slice(0, -1);
		//console.log('Signature Params: ' + params)
		return params;
	}

	//Combine the 3 signature component and URI encode them
	var sig = encodeURIComponent('POST')	+"&" + encodeURIComponent(url) + '&' + encodeURIComponent(printParameters(params));
	//sig = hmacsha1encode(sig);
	//sig = base64encode(sig);
	return sig;
}

exports.uploadSurvey = preparePhotos;
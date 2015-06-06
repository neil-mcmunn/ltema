// upload a survey

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
		var surveyMeta = db.execute('SELECT pa.park_name, pr.protocol_name
									 FORM park pa, protocol pr, site_survey su
									 WHERE pa.park_id = su.park_id
									 AND pr.protocol_id = su.park_id
									 AND su.site_survey_guid = ?', guid);

		var park = surveyMeta.fieldByName('park_name');
		var protoocol = surveyMeta.fieldByName('protocol_name');

		//Get IDs for the park and protocol
		var surveyIDs = db.execute('SELECT pa.park_id, pr.protocol_id
									FROM park pa, protocol pr, site_survey su
									WHERE pa.park_id = su.park_id
									AND pr.protocol_id = su.protocol_id
									AND pa.park_name = ?
									AND pr.protocol_name = ?', park, protocol);

		var protocolID = surveyIDs.fieldByName('protocol_id');
		var parkID = surveyIDs.fieldByName('park_id');

		//Find the media_id, media_name, and flickr_id for each image related to the survey
		//Query - Transect Media
		var transectRows = db.execute( 'SELECT t.transect_id, t.media_id, m.media_name, m.flickr_id\
										FROM media m, transect t, site_survey s, protocol p, park pa\
										WHERE t.media_id = m.media_id\
										AND t.site_id = s.site_id\
										AND s.protocol_id = ?\
										AND s.park_id = ?', protocolID, parkID);

		var uploadMedia = [];
		while(transectRows.isValidRow()){
			var media = {
				mediaID : transectRows.fieldByName('media_id'),
				flickrID : transectRows.fieldByName('flickr_id'),
				name : transectRows.fieldByName('media_name')
			};
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			transectRows.next();
		}
		//Drop the rows from memory
		transectRows = null;

		//Query - Plot Media
		var plotRows = db.execute( 'SELECT p.plot_id, pl.media_id, m.media_name, m.flickr_id\
									FROM media m, plot pl, site_survey s, protocol p, park pa\
									WHERE pl.media_id = m.media_id\
									AND t.site_id = s.site_id\
									AND s.protocol_id = ?\
									AND s.park_id = ?', protocolID, parkID);

		while(plotRows.isValidRow()){
			var media = {
				mediaID : plotRows.fieldByName('media_id'),
				flickrID : plotRows.fieldByName('flickr_id'),
				name : plotRows.fieldByName('media_name')
			};
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			plotRows.next();
		}
		//Drop the rows from memory
		plotRows = null;

		//Query - Plot Observation Media
		var observationRows = db.execute( 'SELECT o.observation_id, m.media_name, m.flickr_id\
										   FROM media m, plot_observations o, site_survey s, protocol p, park pa\
										   WHERE m.media_id = o.media_id\
										   AND o.site_id = s.site_id\
										   AND s.protocol_id = ?\
										   AND s.park_id = ?;', protocolID, parkID);

		while(observationRows.isValidRow()){
			var media = {
				mediaID : observationRows.fieldByName('media_id'),
				flickrID : observationRows.fieldByName('flickr_id'),
				name : observationRows.fieldByName('media_name')
			};
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			observationRows.next();
		}
		//Drop the rows from memory
		observationRows = null;

	}
	catch(e) {
		uploadMedia = undefined;
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	}
	finally{
		db.close();
		//Upload all un-uploaded photos to flickr
		uploadPhotos(uploadMedia, guid, selectProtocol);
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

		//DO: Grab thesse from the cloud instead of hardcoding
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


		var signature = oauthSignature.generate('POST', url, parameters, consumerSecret, tokenSecret);

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
		var surveyMeta = db.execute('SELECT pr.protocol_name
									 FORM protocol pr, site_survey su
									 WHERE pr.protocol_id = su.protocol_id
									 AND su.site_survey_guid = ?', guid);

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
exports.uploadSurvey = uploadSurvey;

//Create a JSON object representing an alpine or grassland survey
//and then serialize it
function formAlpineGrasslandJSON(guid){
	uploadPhotos(siteName);

	try{
		var db = Ti.Database.open('ltemaDB');
	
		//Query - Select metadata for the survey being uploaded
		var metaRows = db.execute( 'SELECT site_survey_guid, year, protocol_id, park_id \
								FROM site_survey \
								WHERE site_survey_guid ?', guid); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT

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

		var transectRows = db.execute( 'SELECT t.transect_id, t.transect_guid, t.transect_name, t.surveyor, t.other_surveyors, t.plot_distance,
										t.stake_orientation, t.utm_zone, t.utm_easting, t.utm_northing, t.comments, t.site_ids, t.site_survey_guid, t.media_id
										FROM transect t
										WHERE t.site_survey_guid = ?', guid); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT
		while(transectRows.isValidRow()){
			var transect = {
				transect_id: transectRows.fieldByName('transect_id'),
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
				site_ids: transectRows.fieldByName('site_ids'),
				site_survey_guid: transectRows.fieldByName('site_survey_guid'),
				media_id: transectRows.fieldByName('media_id')
			};
			survey.transects.push(transect);
			transectRows.next();
		}

		var plotRows = db.execute( 'SELECT site_survey_guid, year, protocol_id, park_id\
									FROM site_survey\
									WHERE site_id = ? AND protocol_id = ?', siteName, protocolName); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT

		while(plotRows.isValidRow()){
			var plot = {
				plot_id: plotRows.fieldByName('plot_id'),
				plot_guid: plotRows.fieldByName('plot_guid'),
				plot_name: plotRows.fieldByName('plot_name'),
				utm_zone: plotRows.fieldByName('utm_zone'),
				utm_northing: plotRows.fieldByName('utm_northing'),
				utm_easting: plotRows.fieldByName('utm_easting'),
				utc: plotRows.fieldByName('utc'),
				stake_deviation: plotRows.fieldByName('stake_deviation'),
				distance_deviation: plotRows.fieldByName('distance_deviation'),
				transect_id: plotRows.fieldByName('transect_id'),
				transect_guid: plotRows.fieldByName('transect_guid'),
				media_id: plotRows.fieldByName('media_id'),
				comment: plotRows.fieldByName('comment')
			};
			survey.plots.push(plot);
			plotRows.next();
		}

		var observationRows = db.execute(	'SELECT ob.observation_id, ob.plot_observation_guid, ob.observation,
											 ob.ground_cover, ob.count, ob.comments, ob.plot_id, ob.plot_guid, ob.media_id, ob.species_code
											 FROM plot_observation ob, plot pl, transect t
											 WHERE ob.plot_guid = pl.plot_guid
											 AND pl.transect_guid = t.transect_guid
											 AND t.site_survey_guid = ?', guid); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT
		while(observationRows.isValidRow()){
			var observation = {
				observation_id: observationRows.fieldByName('observation_id'),
				plot_observation_guid: observationRows.fieldByName('plot_observation_guid'),
				observation: observationRows.fieldByName('observation'),
				ground_cover: observationRows.fieldByName('ground_cover'),
				count: observationRows.fieldByName('count'),
				comments: observationRows.fieldByName('comments'),
				plot_id: observationRows.fieldByName('plot_id'),
				plot_guid: observationRows.fieldByName('plot_guid'),
				media_id: observationRows.fieldByName('media_id'),
				species_code: observationRows.fieldByName('species_code')
			};
			survey.plot_observations.push(observation);
			observationRows.next();
		}

		var transectMedia = db.execute( 'SELECT m.media_id, m.media_name, m.flickr_id
										FROM media m, transect t, site_survey s, protocol p, park pa
										WHERE t.media_id = m.media_id
										AND t.site_survey_guid = ?', guid);

		var plotMedia = db.execute( 'SELECT m.media_id, m.media_name, m.flickr_id
									FROM media m, plot pl, site_survey s, protocol p, park pa
									WHERE pl.media_id = m.media_id
									AND pl.transect_id = t.transect_id
									AND t.site_survey_guid = ?', guid);

		var observationMedia = db.execute( 'SELECT m.media_id, m.media_name, m.flickr_id
										    FROM media m, plot_observations o, site_survey s, plot pl, transect t
										    WHERE m.media_id = o.media_id
										    AND o.plot_id = pl.plot_id
										    AND pl.transect_id = t.transect_id
										    AND t.site_survey_guid = ?;', guid);

		while(transectMedia.isValidRow()){
			var media = {
				media_id: mediaRows.fieldByName('media_id'),
				media_name: mediaRows.fieldByName('media_name'),
				flickr_id: mediaRows.fieldByName('flickr_id')
			};
			survey.media.push(media);
			transectMedia.next();
		}
		while(plotMedia.isValidRow()){
			var media = {
				media_id: mediaRows.fieldByName('media_id'),
				media_name: mediaRows.fieldByName('media_name'),
				flickr_id: mediaRows.fieldByName('flickr_id')
			};
			survey.media.push(media);
			plotMedia.next();
		}
		while(observationMedia.isValidRow()){
			var media = {
				media_id: mediaRows.fieldByName('media_id'),
				media_name: mediaRows.fieldByName('media_name'),
				flickr_id: mediaRows.fieldByName('flickr_id')
			};
			survey.media.push(media);
			observationMedia.next();
		}

	}
	catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	}
	finally{
		db.close();
		uploadJSON(survey, guid);
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
		}
		httpClient.onerror = function(e) {
			Ti.API.debug("STATUS: " + this.status);
			Ti.API.debug("TEXT:   " + this.responseText);
			Ti.API.debug("ERROR:  " + e.error);
		}
		var currentDate = new Date();
		var now = currentDate.toISOString();

		httpClient.send(
				JSON.stringify(
					{
						site: survey.site_survey.site_survey_guid,
						protocol: survey.site_survey.protocol_id,
						survey_data: survey,
						date_surveyed: now,
						version_no: survey.site_survey.version_no
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


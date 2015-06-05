// upload a survey

var uuid = require('uuid.js');
var OAuthSig = require('oauth-signature');

function preparePhotos(guid) {
	try{
		var db = Ti.Database.open('ltemaDB');
		
		//Query - Resolve
		var surveyMeta = db.execute('SELECT pa.park_name, pr.protocol_name
									 FORM park pa, protocol pr, site_survey su
									 WHERE pa.park_id = su.park_id
									 AND pr.protocol_id = su.park_id
									 AND su.site_survey_guid = ?', guid);

		var park = surveyMeta.fieldByName('park_name');
		var protoocol = surveyMeta.fieldByName('protocol_name');

		//Query - Resolve park and protocol ids from names
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
		var transectRows = db.execute( 'SELECT t.transect_id, t.media_id, m.media_name, m.flickr_id
										FROM media m, transect t, site_survey s, protocol p, park pa
										WHERE t.media_id = m.media_id
										AND t.site_id = s.site_id
										AND s.protocol_id = ?
										AND s.park_id = ?', protocolID, parkID);

		//Query - Plot Media
		var plotRows = db.execute( 'SELECT p.plot_id, pl.media_id, m.media_name, m.flickr_id
									FROM media m, plot pl, site_survey s, protocol p, park pa
									WHERE pl.media_id = m.media_id
									AND t.site_id = s.site_id
									AND s.protocol_id = ?
									AND s.park_id = ?', protocolID, parkID);

		//Query - Plot Observation Media
		var observationRows = db.execute( 'SELECT o.observation_id, m.media_name, m.flickr_id
										   FROM media m, plot_observations o, site_survey s, protocol p, park pa
										   WHERE m.media_id = o.media_id
										   AND o.site_id = s.site_id
										   AND s.protocol_id = ?
										   AND s.park_id = ?;', protocolID, parkID);

		//Push media that requires uploading into a single array
		var uploadMedia = [];
		while(transectRows.isValidRow()){
			var media = {
				mediaID : transectRows.fieldByName('media_id'),
				flickrID : transectRows.fieldByName('flickr_id'),
				name : transectRows.fieldByName('media_name')
			}
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			transectRows.next();
		}

		while(plotRows.isValidRow()){
			var media = {
				mediaID : plotRows.fieldByName('media_id'),
				flickrID : plotRows.fieldByName('flickr_id'),
				name : plotRows.fieldByName('media_name')
			}
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			plotRows.next();
		}

		while(observationRows.isValidRow()){
			var media = {
				mediaID : observationRows.fieldByName('media_id'),
				flickrID : observationRows.fieldByName('flickr_id'),
				name : observationRows.fieldByName('media_name')
			}
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			observationRows.next();
		}

	}
	catch(e) {
		uploadMedia = undefined;
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	}
	finally{
		db.close();
		//Upload all un-uploaded photos to flickr
		uploadPhotos(uploadMedia);
	}

	
}

function uploadPhotos (media){
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

		//access token
		var access_token = '72157653043488540-7736b541f64cb249';
		//Access token secret
		var access_secret = '637c9b9f2dbaf4f8';
		
		var consumer_key = '64f42b582341e05e4ee18e90159f9fdf';
		var consumer_secret = '2f7f3db0091886d1';

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


		signature = oauthSignature.generate('POST', url, parameters, consumerSecret, tokenSecret);

		var xhr = Titanium.Network.createHTTPClient({
			onload : function(e) {
				//Handle photo guids here
				//Get photo id from xml
				var xml = this.responseXML;
				var photoID = xml.getAttribute('photoid');

				//Update media row to reflect flickr id
				try{
					var db = Ti.Database.open('ltemaDB');
				
					//Query - Select metadata for the survey being uploaded
					var rows = db.execute( 'UPDATE media
											SET flickr_id = ?
											WHERE media_id = ?', photoID, media[n].flickrID); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT
				}
				catch(e) {
					var errorMessage = e.message;
					Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
				}
				finally{
					db.close();
				}
			},
			
			onerror : function(e) {
				//handle errors
			},
			timeout : 30000
		});

		xhr.open('POST', url);
		xhr.send({
			photo: photo
			hidden: parameters.hidden
			oauth_consumer_key: consumer_key,
			oauth_signature_method: 'HMAC-SHA1',
			oauth_token: access_token,
			oauth_timestamp: timestamp,
			ouath_nonce: nonce,
			oauth_version:'1.0'
		});

	}
}

function selectProtocol (siteName, protocolName){
	//Create arrays to hold objects relevant to this survey
	var surveyJSON;


	
	//Form data for the given protocol
	switch(protocolName){
		case 'Alpine':
		case 'Grassland':
			formAlpineGrasslandJSON(siteName);
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
function formAlpineGrasslandJSON(siteName, protocolName){
	uploadPhotos(siteName);

	try{
		var db = Ti.Database.open('ltemaDB');
	
		//Query - Select metadata for the survey being uploaded
		var rows = db.execute( 'SELECT site_survey_guid, year, protocol_id, park_id \
								FROM site_survey \
								WHERE site_id = ? AND protocol_id = ?', siteName, protocolName); //TODO: MAKE SURE THESE NUMBERS ARE WHAT WE WANT

		var survey = {
			transects : [],
			plots : [],
			plot_observations : [],
			media : [],
			survey_meta : {
				site_survey_guid : rows.fieldByName('site_survey_guid'),
				year : rows.fieldByName('year'),
				protocol_id : rows.fieldByName('protocol_id'),
				park_id : rows.fieldByName('park_id')
			}
		}
	}
	catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	}
	finally{
		db.close();
	}
}

function uploadJSON() {
	
}

/*
//Create a JSON object representing an intertidal survey
//and then serialize it
function formIntertidalJSON(){
	
}
*/
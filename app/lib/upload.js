// upload a survey
//
function uploadPhotos(site, protocol) {
	try{
		var db = Ti.Database.open('ltemaDB');
	
		//Query - Resolve park and protocol ids
		var surveyIDs = db.execute('SELECT pa.park_id, pr.protocol_id
									FROM park pa, protocol pr, site_survey su
									WHERE pa.park_id = su.park_id
									AND pr.protocol_id = su.protocol_id
									AND pa.park_name = ?
									AND pr.protocol_name = ?', park, protocol);

		var protocolID = surveyIDs.fieldByName('protocol_id');
		var parkID = surveyIDs.fieldByName('park_id');

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
										   AND s.park_id = ?
										   ;', protocolID, parkID);

		//Push media that requires uploading into a single array
		var uploadMedia = [];
		while(transectRows.isValidRow()){
			var media = {
				mediaID : transectRows.fieldByName('media_id')
				flickrID : transectRows.fieldByName('flickr_id')
				name : transectRows.fieldByName('media_name')
			}
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			transectRows.next();
		}

		while(plotRows.isValidRow()){
			var media = {
				mediaID : plotRows.fieldByName('media_id')
				flickrID : plotRows.fieldByName('flickr_id')
				name : plotRows.fieldByName('media_name')
			}
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			plotRows.next();
		}

		while(observationRows.isValidRow()){
			var media = {
				mediaID : observationRows.fieldByName('media_id')
				flickrID : observationRows.fieldByName('flickr_id')
				name : observationRows.fieldByName('media_name')
			}
			if(media.flickrID == null || media.flickrID == undefined){
				uploadMedia.push(media);
			}
			observationRows.next();
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

function uploadSurvey (siteName, protocolName){
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
	}
	catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	}
	finally{
		db.close();
	}
	
	var survey = {
		transects : []
		plots : []
		plot_observations : []
		media : []
		survey_meta : {
			site_survey_guid :
			year :
			protocol_id : 
			park_id : 
		}
	}
	
	return survey;
}

function uploadJSON() {

}

/*
//Create a JSON object representing an intertidal survey
//and then serialize it
function formIntertidalJSON(){
	
}
*/
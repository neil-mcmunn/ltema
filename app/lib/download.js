// download a survey
// must specify the site_survey_guid
function imageDownload(media){
	console.log('Media Download');
	console.log(media);
	//go through media looking for object with a flickr id
	var image = null;
	for(var i = 0; i < media.length; i++){
		if(media[i].media_name === null){
			image = i;
			break;
		}
	}
	//no images are left to download
	if(image === null){
		console.log('Media Download - All image have been downloaded');
		Ti.App.fireEvent("app:refreshSiteSurveys");
	}
	//otherwise an image is found and that image is then downloaded
	else{
		console.log('Media Downloaded - Image number ' + image + ' to be downloaded');
		var imageRecord = media[image];
		var url = 'http://i.imgur.com/' + imageRecord.flickr_id + '.jpg';
		//Download Image form Imgur
 		var path = null;
 		var fileName = imageRecord.flick_id + '.jpg';
	    var file = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, fileName);
	    if ( file.exists() ) {
	        //Update Database
			var db = Ti.Database.open('ltemaDB');
			var mediaName = media.flickr_id + '.jpg';
			db.execute('UPDATE TABLE media SET media_name = ? WHERE flickr_id = ?', mediaName, imageRecord.flickr_id);
	    } else {
	        if ( Titanium.Network.online ) {
	            var xhr = Titanium.Network.createHTTPClient({
		            onload : function(e) {
						try{
							//Wite image from Imgur to iPad
							console.log(this.responseData);
							file.write(this.responseData);
							//Update Database
							var db = Ti.Database.open('ltemaDB');
							//Weird Bug where SQL won't update.
							db.execute('UPDATE media SET media_name = ? WHERE flickr_id = ?', fileName, imageRecord.flickr_id);
						}
						catch(e) {
							var errorMessage = e.message;
							Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
						}
						finally{
							db.close();
							imageDownload(media);
						}
					},
					onerror : function(e) {
						console.log('Something bad happened: {status: ' + this.status + ', statusText: ' + this.statusText + '}');
						console.log('This: ' + this);
					},
					timeout : 30000
				});
	            //Open connection
	            xhr.open('GET',url);
	            //Send request
			    xhr.send();           
			    
			} else {
			    file_obj.error = 'no internet';
	            fn_end(file_obj);
	        }
	    }
	}
}

function processDownload(cloudSurvey, siteSurveyGUID) {
    //do stuff with cloudSurvey
    // expected fields: site, protocol, date_surveyed, last_modified, version_no, exported,
    //   survey_data {transects[], plots[], plot_observations[], media[], survey_meta}
    
   try {
    	console.log ('enter try in download');
    	//Extract data from cloud survey
    	var surveyData = cloudSurvey.survey_data;
    	var surveyMeta = surveyData.survey_meta;
		var cloudMedia = surveyData.media;
		var cloudTransects = surveyData.transects;
    	var cloudPlots = surveyData.plots;
		var plotObservations = surveyData.plot_observations;
	    var protocolID = cloudSurvey.protocol_id;
	    var parkID = cloudSurvey.park_id;
	    
	    // Check if this site has been previously surveyed
	    var db = Ti.Database.open('ltemaDB');			
		var previousID = db.execute('SELECT site_survey_guid FROM site_survey \
										WHERE protocol_id = ? \
										AND park_id = ?', protocolID, parkID);

		var guidPassedFromDownloadFn = siteSurveyGUID;
		var prevSiteGUID = previousID.fieldByName('site_survey_guid');
		var cloudSiteSurveyGUID = surveyMeta.site_survey_guid;
		console.log('download: ' + guidPassedFromDownloadFn);
		console.log('prevGUID: ' + prevSiteGUID);
		console.log('cloudGUID:' + cloudSiteSurveyGUID);
		
		var siteSurveyGUID = prevSiteGUID;
		if (siteSurveyGUID != cloudSiteSurveyGUID) {
			console.log('old siteSurvey differs from cloud. Setting siteSurveyGUID to cloud value');
			siteSurveyGUID = cloudSiteSurveyGUID;
		}

		console.log('siteSurveyGUID line 169 (download): ' + siteSurveyGUID);
				
    	// compare dates between old and cloud data
		var oldDate = db.execute('SELECT year FROM site_survey WHERE site_survey_guid = ?', siteSurveyGUID);
		var oldYear = oldDate.fieldByName('year');
		var cloudYear = cloudSurvey.last_modified.slice(0,4);
    	console.log ('old year, new year: ' + oldYear + ', ' + cloudYear);
    	
    	var year = oldDate;    	
    	if (cloudYear >= oldYear) {
    		year = cloudYear;
    		console.log ('updated year: ', year);
    	}
    	
    	var cloudVersion = cloudSurvey.version_no;
    	console.log('cloud version: ' + cloudVersion + ', site survey guid is: ' + siteSurveyGUID);
    	var deviceVersionQuery = db.execute('SELECT version_no FROM site_survey WHERE site_survey_guid = ?', siteSurveyGUID);
		var deviceVersion = deviceVersionQuery.fieldByName('version_no');
		console.log('device version_no: ' + deviceVersion);
		
		if (deviceVersion >= cloudVersion) {
			// Inform user that device version is newer and don't change database'
			alert('version on DEVICE is newer!\n old is ' + deviceVersion + ' new is ' + cloudVersion);

		} else {			
			//Insert the updated survey
			alert('version on CLOUD is newer!\n old is ' + deviceVersion + ' new is ' + cloudVersion);
			
			var siteGUID = cloudSiteSurveyGUID;
			//delete existing data
			db.execute('DELETE FROM site_survey WHERE site_survey_guid = ?', siteGUID);
			
			console.log('(download, Else clause) siteGUID: ' + typeof siteGUID + ' as ' + siteGUID);
			//db.execute('UPDATE site_survey SET year=? WHERE site_survey_guid=?', currentYear, siteGUID);
			db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id, version_no) VALUES (?,?,?,?,?)', 
												siteGUID, year, protocolID, parkID, cloudVersion);
			
			// Copy and associate any existing transects media and id's'
			for (var i = 0; i < cloudMedia.length; i++) {
				var oldMediaID = cloudMedia[i].media_id;
				var flickrID = cloudMedia[i].flickr_id;
				
				// insert flickr_id and extract auto-incremented media_id and store in media blob
				db.execute('INSERT INTO media (flickr_id) VALUES (?);', flickrID);
				var results = db.execute('SELECT last_insert_rowid() as mediaID');
				var newMediaID = results.fieldByName('mediaID');
				
				cloudMedia[i].new_media_id = newMediaID;
			}
			
			// copy of unmodified array to search through only if super-user
			var photoCloudMedia = JSON.parse(JSON.stringify(cloudMedia));
			
			// Copy and associate any existing transects
			for (var i = 0; i < cloudTransects.length; i++) {
				/*
				var siteGUID_FK = cloudTransects[i].site_survey_guid;
				if (siteGUID_FK != siteGUID) {
					continue;
				}
				*/
				console.log('this is transect #: ' + i);
				
				var transectGUID = cloudTransects[i].transect_guid;
				var transectName = cloudTransects[i].transect_name;
				var surveyor = cloudTransects[i].surveyor;
				var otherSurveyors = cloudTransects[i].other_surveyors;
				var plotDistance = cloudTransects[i].plot_distance;
				var stakeOrientation = cloudTransects[i].stake_orientation;
				var utmZone = cloudTransects[i].utm_zone;
				var utmEasting = cloudTransects[i].utm_easting;
				var utmNorthing = cloudTransects[i].utm_northing;
				var tComments = cloudTransects[i].comments;
				var transectOldMediaID = cloudTransects[i].media_id;
				
				// use old media id from cloud to map to new media id
				var transectNewMediaID = null;
				for (var m = 0; m < cloudMedia.length; i++) {
					if (transectOldMediaID == cloudMedia[m].media_id) {
						transectNewMediaID = cloudMedia[m].new_media_id;
						//remove this row to save time for future iterations
						cloudMedia.splice(m, 1);
						break;
					}
				}
				
				db.execute('INSERT INTO transect (transect_guid, transect_name, surveyor, other_surveyors, \
					plot_distance, stake_orientation, utm_zone, utm_easting, utm_northing, comments, site_survey_guid, media_id) \
					VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', transectGUID, transectName, surveyor, otherSurveyors, 
					plotDistance, stakeOrientation, utmZone, utmEasting, utmNorthing, tComments, siteGUID, transectNewMediaID);
				
				// Copy and associate any existing plots
				for (var j = 0; j < cloudPlots.length; j++) {
					
					var transectGUID_FK = cloudPlots[j].transect_guid;
					if (transectGUID_FK != transectGUID) {
						continue;
					}
					
					console.log('this is plot #: ' + j);
					
					var plotGUID = cloudPlots[j].plot_guid;
					var plotName = cloudPlots[j].plot_name;
					var plotUtmZone = cloudPlots[j].utm_zone;
					var plotUtmEasting = cloudPlots[j].utm_easting;
					var plotUtmNorthing = cloudPlots[j].utm_northing;
					var utc = cloudPlots[j].utc;
					var stakeDeviation = cloudPlots[j].stake_deviation;
					var distanceDeviation = cloudPlots[j].distance_deviation;
					var plotComments = cloudPlots[j].comments;
					var plotOldMediaID = cloudPlots[j].media_id;
					
					// use old media id from cloud to map to new media id
					var plotNewMediaID = null;
					for (var m = 0; m < cloudMedia.length; m++) {
						
						if (plotOldMediaID == cloudMedia[m].media_id) {
							plotNewMediaID = cloudMedia[m].new_media_id;
							//remove this row to save time for future iterations
							console.log('inserting media ' + cloudMedia[m].new_media_id + ' into plot: ' + j);
							cloudMedia.splice(m, 1);
							break;
						}
					}
					
					db.execute('INSERT INTO plot (plot_guid, plot_name, utm_zone, utm_easting, utm_northing, utc, stake_deviation, distance_deviation, \
						transect_guid, comments, media_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)', plotGUID, plotName, plotUtmZone, plotUtmEasting, plotUtmNorthing,
						utc, stakeDeviation, distanceDeviation, transectGUID, plotComments, plotNewMediaID);
						
					// Copy and associate any existing plot observations
					for (var k = 0; k < plotObservations.length; k++) {
						
						var plotGUID_FK = plotObservations[k].plot_guid;
						if (plotGUID_FK != plotGUID) {
							continue;
						}
						
						console.log('this is plot obs #: ' + k);
						
						var observationGUID = plotObservations[k].plot_observation_guid;
						var observation = plotObservations[k].observation;
						var groundCover = plotObservations[k].ground_cover;
						var count = plotObservations[k].count;
						var observationComments = plotObservations[k].comments;
						var plotObsOldMediaID = plotObservations[k].media_id;
						var speciesCode = plotObservations[k].species_code;
					
						// use old media id from cloud to map to new media id
						var plotObsNewMediaID = null;
						for (var m = 0; m < cloudMedia.length; m++) {
							
							if (plotObsOldMediaID == cloudMedia[m].media_id) {
								plotObsNewMediaID = cloudMedia[m].new_media_id;
								//remove this row to save time for future iterations
								console.log('inserting media ' + cloudMedia[m].new_media_id + ' into plot observation: ' + k);
								
								cloudMedia.splice(m, 1);
								break;
							}
						}
					
						db.execute('INSERT INTO plot_observation (plot_observation_guid, observation, ground_cover, count, comments, plot_guid, media_id, species_code) \
							VALUES (?,?,?,?,?,?,?,?)', observationGUID, observation, groundCover, count, observationComments, plotGUID, plotObsNewMediaID, speciesCode);
						
					}	
				}
				for(var m = 0; m < photoCloudMedia.length; m++){
					photoCloudMedia[m].media_name = null;
				}
				// download flickr media
				imageDownload(photoCloudMedia);
			}
		}
				
	} catch (e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
	}

}

function downloadSurvey(siteSurveyGUID) {
    try {
        console.log('enter try in downloadSurvey');
        var url = "https://capstone-ltemac.herokuapp.com/surveys/" + siteSurveyGUID;
        //alert('download url: ' + url);
        var httpClient = Ti.Network.createHTTPClient();

        httpClient.open("GET", url);

        // httpClient.setRequestHeader('secret', '12345-12345-12345-12345-12345');
        httpClient.setRequestHeader('secret', Ti.App.Properties.getString('secret'));
        httpClient.setRequestHeader('Content-Type', 'application/json');

        httpClient.onload = function() {
            //call checkLocalSurveys, pass in results
            Ti.API.info("Downloading...");
            var returnArray = JSON.parse(this.responseData);
            processDownload(returnArray, siteSurveyGUID);
            alert('download processed');
        };
        httpClient.onerror = function(e) {
            Ti.API.debug("STATUS: " + this.status);
            Ti.API.debug("TEXT:   " + this.responseText);
            Ti.API.debug("ERROR:  " + e.error);
            var cloudSurveys = [];
            processDownload(cloudSurveys, siteSurveyGUID);
            alert('error retrieving remote data');
        };

        httpClient.send();

        console.log('leaving try downloadSurvey gracefully');
    }
    catch (e) {
        var errorMessage = e.message;
        console.log('error in downloadSurvey: ' + errorMessage);
    }
}

exports.downloadSurvey = downloadSurvey;
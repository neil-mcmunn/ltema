// download a survey
// must specify the site_survey_guid
function downloadSurvey(siteSurveyGUID) {
    try {
    	Ti.App.fireEvent("app:downloadStarted");
        console.log('enter try in downloadSurvey');
        var url = "https://capstone-ltemac.herokuapp.com/surveys/" + siteSurveyGUID;
        
        var httpClient = Ti.Network.createHTTPClient();

        httpClient.open("GET", url);

        httpClient.setRequestHeader('secret', Ti.App.Properties.getString('secret'));
        httpClient.setRequestHeader('Content-Type', 'application/json');

        httpClient.onload = function() {
            //call checkLocalSurveys, pass in results
            Ti.API.info("Downloading...");
            var returnArray = JSON.parse(this.responseData);
            processDownload(returnArray, siteSurveyGUID);
            //alert('download processed');
        };
        httpClient.onerror = function(e) {
            Ti.API.debug("STATUS: " + this.status);
            Ti.API.debug("TEXT:   " + this.responseText);
            Ti.API.debug("ERROR:  " + e.error);
            alert('error retrieving remote data');
        };

        httpClient.send();
    }
    catch (e) {
        var errorMessage = e.message;
        console.log('error in downloadSurvey: ' + errorMessage);
        Ti.App.fireEvent("app:downloadFailed");
    }
}

function processDownload(cloudSurvey, siteSurveyGUID) {
    //do stuff with cloudSurvey
    // expected survey object format: survey_data {transects[], plots[], plot_observations[], media[], survey_meta}
    
   try {
    	console.log ('enter try in process download');
    	
	    var db = Ti.Database.open('ltemaDB');			
	    
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
		var previousID = db.execute('SELECT site_survey_guid FROM site_survey \
										WHERE protocol_id = ? \
										AND park_id = ?', protocolID, parkID);
		
		var prevSiteGUID = previousID.fieldByName('site_survey_guid');
		var cloudSiteSurveyGUID = surveyMeta.site_survey_guid;
		
		var siteSurveyGUID = prevSiteGUID;
		if (siteSurveyGUID != cloudSiteSurveyGUID) {
			siteSurveyGUID = cloudSiteSurveyGUID;
		}
				
    	// compare dates between old and cloud data
		var oldDate = db.execute('SELECT year FROM site_survey WHERE site_survey_guid = ?', siteSurveyGUID);
		var oldYear = oldDate.fieldByName('year');
		var cloudYear = cloudSurvey.last_modified.slice(0,4);
    	
    	var year = oldDate;    	
    	if (cloudYear >= oldYear) {
    		year = cloudYear;
    	}
    	
    	var cloudVersion = cloudSurvey.version_no;
    	var deviceVersionQuery = db.execute('SELECT version_no FROM site_survey WHERE site_survey_guid = ?', siteSurveyGUID);
		var deviceVersion = deviceVersionQuery.fieldByName('version_no');
		
		if (deviceVersion >= cloudVersion) {
			// Inform user that device version is newer and don't change database'
		} else {			
			//Insert the updated survey
			var siteGUID = cloudSiteSurveyGUID;
			//delete existing data
			db.execute('DELETE FROM site_survey WHERE site_survey_guid = ?', siteGUID);
			
			var d = new Date();
			var exported = d.getTime();
			db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id, version_no, exported) VALUES (?,?,?,?,?,?)', 
												siteGUID, year, protocolID, parkID, cloudVersion, exported);
			
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
				imageDownload(photoCloudMedia, siteSurveyGUID);
			}
		}
				
	} catch (e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		Ti.App.fireEvent("app:downloadFailed");
	} finally {
		db.close();
	}

}


function imageDownload(media, guid){
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
		Ti.App.fireEvent("app:downloadFinished");
		Ti.App.fireEvent("app:refreshSiteSurveys");
	}
	//otherwise an image is found and that image is then downloaded
	else{
		console.log('Media Downloaded - Image number ' + image + ' to be downloaded');
		var imageRecord = media[image];
		var url = 'http://i.imgur.com/' + imageRecord.flickr_id + '.jpg';
		//Download Image form Imgur
 		var fileName = imageRecord.flickr_id + '.png';
 		
 		var db = Ti.Database.open('ltemaDB');
		var dirInfo = db.execute('SELECT s.year, p.protocol_name, prk.park_name \
						FROM site_survey s, protocol p, park prk \
						WHERE s.protocol_id = p.protocol_id \
						AND s.park_id = prk.park_id \
						AND site_survey_guid = ?', guid);
						
		var year = dirInfo.fieldByName('year');
		var protocolName = dirInfo.fieldByName('protocol_name');
		var parkName = dirInfo.fieldByName('park_name');
		var dir = year + ' - ' + protocolName + ' - ' + parkName;
		//Check to see if survey folder exists
		var imageDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
		//Create if it doesn't
		if (! imageDir.exists()) {
			imageDir.createDirectory();
		}
		
		var file = Ti.Filesystem.getFile(imageDir.resolve(), fileName);
 		db.close();
 		
	    //var file = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, fileName);
	    if ( file.exists() ) {
	    	console.log('Media Download - media exists');
	        //Update Database
			var db = Ti.Database.open('ltemaDB');
			db.execute('UPDATE media SET media_name = ? WHERE flickr_id = ?', fileName, imageRecord.flickr_id);
			imageRecord.media_name = fileName;
			imageDownload(media, guid);
			db.close();
	    } else {
	    	console.log('Media Download - media doesn\'t exist');
	        if ( Titanium.Network.online ) {
	            var xhr = Titanium.Network.createHTTPClient({
		            onload : function(e) {
						try{
							//Wite image from Imgur to iPad
							console.log('Imgur response: ' + this.responseData);
							file.write(this.responseData);
							imageRecord.media_name = fileName;
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
							imageDownload(media, guid);
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


exports.downloadSurvey = downloadSurvey;
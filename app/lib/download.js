// download a survey
// must specify the site and protocol
//var uuid = require('./uuid');

function processDownload(cloudSurvey) {
    //do stuff with surveyData
    // expected fields: site, site_survey_guid, year, protocol_id, park_id, exported, transect_guid, transect_name, surveyor, other_surveyors, plot_distance,
    //   stake_orientation, utm_zone, utm_easting, utm_northing, comments, flickr_id, plot_guid, plot_name, 
   try {
    	console.log ('enter try in download');
    	var db = Ti.Database.open('ltemaDB');
    	console.log ('database opened successfuly');
    	
    	var surveyData = cloudSurvey.survey_data;
    	console.log('THE DOWNLOAD');
    	//console.log(surveyData);
    	console.log('site and protocol: ' + cloudSurvey.site + ' ' + cloudSurvey.protocol);
    	
    	var protocolIDResult = db.execute('SELECT protocol_id FROM protocol WHERE protocol_name =?', cloudSurvey.protocol);
    	var protocolID = protocolIDResult.fieldByName('protocol_id');
    	console.log ('protocol id : ' + protocolID);
    	var parkIDResult = db.execute('SELECT park_id FROM park WHERE park_name =?', cloudSurvey.site);
    	var parkID = parkIDResult.fieldByName('park_id');
    	console.log ('park id : ' + parkID);
    	var year = cloudSurvey.last_modified.slice(0,4);
    	console.log ('year: ' + year);
    	
		console.log('line 25 (download)');
		
		// Check if this site has been previously surveyed
		var previousID = db.execute('SELECT site_survey_guid FROM site_survey \
										WHERE protocol_id = ? \
										AND park_id = ?', protocolID, parkID);

		var prevSiteGUID = previousID.fieldByName('site_survey_guid');
		
		if (prevSiteGUID == null) {
			console.log('prevSiteGUID was null');
			prevSiteGUID = surveyData[0].site_guid;
			console.log('guid value: ' + prevSiteGUID);
		}

		console.log('id line 34 (download): ' + prevSiteID + ' and guid: ' + prevSiteGUID);

		if (!prevSiteID) {
			// Insert the new survey
			//var siteGUID = String(uuid.generateUUID());
			//var results = db.execute('SELECT last_insert_rowid() as siteID');
	
			console.log('processDownload variable list with types: ');
			console.log('siteID: ' + typeof siteID + ' as ' + siteID);
			//console.log('siteGUID: ' + typeof siteGUID + ' as ' + siteGUID);
			console.log('currentYear: ' + typeof year + ' as ' + year);
			console.log('protocolID: ' + typeof protocolID + ' as ' + protocolID);
			console.log('parkID: ' + typeof parkID + ' as ' + parkID);
	
			//db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id) VALUES (?,?,?,?)', siteGUID, year, protocolID, parkID);
	
			console.log('after insert download line 50');

		// Get the transects associated with the survey
		} else {			
			//var siteID = prevSiteID;
			var siteGUID = prevSiteGUID;
			//delete existing data
			db.execute('DELETE FROM site_survey WHERE site_survey_guid = ?', siteGUID);
			
			console.log('(download, Else clause) siteGUID: ' + typeof siteGUID + ' as ' + siteGUID);
			//db.execute('UPDATE site_survey SET year=? WHERE site_survey_guid=?', currentYear, siteGUID);
			db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id) VALUES (?,?,?,?)', siteGUID, year, protocolID, parkID);
			
			var transects = db.execute('SELECT * FROM transect WHERE site_survey_guid = ?', siteGUID);
		
			// Copy and associate any existing transects
			var cloudTransects = surveyData.transects;
			for (var i = 0; i < cloudTransects.length; i++) {
				var siteGUID_FK = cloudTransect[i].site_survey_guid;
				if (siteGUID_FK == siteGUID) {
					continue;
				}
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
				var transectFlickrID = cloudTransects[i].flickr_id;
				
				db.execute('INSERT INTO transect (transect_guid, transect_name, surveyor, other_surveyors, \
					plot_distance, stake_orientation, utm_zone, utm_easting, utm_northing, comments, site_guid, flickr_id) \
					VALUES (?,?,?,?,?,?,?,?,?,?,?)', transectGUID, transectName, surveyor, otherSurveyors, 
					plotDistance, stakeOrientation, utmZone, utmEasting, utmNorthing, tComments, siteGUID);
	
				// Get any plots associated with the transect
				var plots = db.execute('SELECT * FROM plot WHERE transect_guid = ?', transectGUID);
				
				// Copy and associate any existing plots
				var cloudPlots = surveyData.plots;
				for (var j = 0; j < cloudPlots.length; j++) {
					var transectGUID_FK = cloudPlots[j].transect_guid;
					if (transectGUID_FK != transectGUID) {
						continue;
					}
					var plotGUID = cloudPlots[j].plot_guid;
					var plotName = cloudPlots[j].plot_name;
					var plotUtmZone = cloudPlots[j].utm_zone;
					var plotUtmEasting = cloudPlots[j].utm_easting;
					var plotUtmNorthing = cloudPlots[j].utm_northing;
					var utc = cloudPlots[j].utc;
					var stakeDeviation = cloudPlots[j].stake_deviation;
					var distanceDeviation = cloudPlots[j].distance_deviation;
					var plotComments = cloudPlots[j].comments;
					var plotFlickrID = cloudPlots[j].flickr_id;
					
					db.execute('INSERT INTO plot (plot_id, plot_name, utm_zone, utm_easting, utm_northing, utc, stake_deviation, distance_deviation, \
						transect_guid, comments, flickr_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)', plotID, plotName, plotUtmZone, plotUtmEasting, plotUtmNorthing,
						utc, stakeDeviation, distanceDeviation, transectGUID, plotComments, plotFlickrID);
						
    					// Copy and associate any existing plot observations
					var plotObservations = surveyData.plot_observations;
					for (var k = 0; k < plotObservations.length; k++) {
						var plotGUID_FK = plotObservations[k].plot_guid;
						if (plotGUID_FK != plotGUID) {
							continue;
						}
						var observationGUID = plotObservations[k].plot_observation_guid;
						var observation = plotObservations[k].observation;
						var groundCover = 0;
						var count = plotObservations[k].count;
						var observationComments = plotObservations[k].comments;
						var plobsFlickrID = plotObservations[k].flickr_id;
						var speciesCode = plotObservations[k].species_code;
					
						db.execute('INSERT INTO plot_observation (observation_id, observation, ground_cover, count, comments, plot_guid, flickr_id, species_code) \
							VALUES (?,?,?,?,?,?,?,?)', observationID, observation, groundCover, count, observationComments, plotGUID, plobsFlickrID, speciesCode);
						
					}	
				}
			}
		}
				
	} catch (e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		Ti.App.fireEvent("app:refreshSiteSurveys");
	}

}

function downloadSurvey(site, protocol) {
    try {
        console.log('enter try in downloadSurvey');

        var url = "https://capstone-ltemac.herokuapp.com/download?park=" + encodeURIComponent(site) + "&protocol=" + protocol;
        alert('download url: ' + url);
        var httpClient = Ti.Network.createHTTPClient();

        httpClient.open("GET", url);

        httpClient.setRequestHeader('secret', '12345-12345-12345-12345-12345');
        httpClient.setRequestHeader('Content-Type', 'application/json');

        httpClient.onload = function() {
            //call checkLocalSurveys, pass in results
            Ti.API.info("Downloaded text: " + this.responseData);
            var returnArray = JSON.parse(this.responseData);
            processDownload(returnArray);
            alert('successful download');
        };
        httpClient.onerror = function(e) {
            Ti.API.debug("STATUS: " + this.status);
            Ti.API.debug("TEXT:   " + this.responseText);
            Ti.API.debug("ERROR:  " + e.error);
            var cloudSurveys = [];
            processDownload(cloudSurveys);
            alert('error retrieving remote data');
        };

        httpClient.send();

        console.log('leaving try downloadSurvey gracefully');
    }
    catch (e) {
        var errorMessage = e.message;
        console.log('error in checkSurveys: ' + errorMessage);
    }
}

exports.downloadSurvey = downloadSurvey;
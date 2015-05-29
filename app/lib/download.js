// download a survey
// must specify the site and protocol
//var uuid = require('./uuid');

function processDownload(cloudSurvey) {
    //do stuff with surveyData
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
    	
		console.log('eline 25 (download)');
		
		// Check if this site has been previously surveyed
		var previousID = db.execute('SELECT site_id, site_survey_guid FROM site_survey \
										WHERE protocol_id = ? \
										AND park_id = ?', protocolID, parkID);

		var prevSiteID = previousID.fieldByName('site_id');
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
			//updating existing site
			var previousID = db.execute('SELECT site_id FROM site_survey \
										WHERE site_survey_guid = ?', siteGUID);

			var siteID = previousID.fieldByName('site_id');
			
			//var siteID = prevSiteID;
			var siteGUID = prevSiteGUID;
			//delete existing data
			db.execute('DELETE FROM site_survey WHERE site_survey_guid = ?', siteGUID);
			
			console.log('(download, Else clause) siteGUID: ' + typeof siteGUID + ' as ' + siteGUID);
			//db.execute('UPDATE site_survey SET year=? WHERE site_survey_guid=?', currentYear, siteGUID);
			db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id) VALUES (?,?,?,?)', siteGUID, year, protocolID, parkID);
			
			var transects = db.execute('SELECT * FROM transect WHERE site_survey_guid = ?', siteGUID);
		
			// Copy and associate any existing transects
			for (var i = 0; i < surveyData.length; i++) {
				var transectGUID = surveyData[i].transect_guid;
				var transectName = surveyData[i].transect_name;
				var surveyor = surveyData[i].surveyor;
				var otherSurveyors = surveyData[i].other_surveyors;
				var plotDistance = surveyData[i].plot_distance;
				var stakeOrientation = surveyData[i].stake_orientation;
				var utmZone = surveyData[i].utm_zone;
				var utmEasting = surveyData[i].utm_easting;
				var utmNorthing = surveyData[i].utm_northing;
				var tComments = surveyData[i].comments;
				var transectID = surveyData[i].transect_id;
				var transectMediaID = surveyData[i].media_id;
				
				db.execute('INSERT INTO transect (transect_guid, transect_name, surveyor, other_surveyors, \
					plot_distance, stake_orientation, utm_zone, utm_easting, utm_northing, comments, site_id) \
					VALUES (?,?,?,?,?,?,?,?,?,?,?) WHERE transect_guid = ?', transectGUID, transectName, surveyor, otherSurveyors, 
					plotDistance, stakeOrientation, utmZone, utmEasting, utmNorthing, tComments, siteID, transectGUID);
	
				// Get any plots associated with the transect
				var plots = db.execute('SELECT * FROM plot WHERE transect_guid = ?', transectGUID);
				
				// Copy and associate any existing plots
				while (plots.isValidRow()) {
					var plotID = plots.fieldByName('plot_id');
					var plotName = plots.fieldByName('plot_name');
					var plotUtmZone = plots.fieldByName('utm_zone');
					var plotUtmEasting = plots.fieldByName('utm_easting');
					var plotUtmNorthing = plots.fieldByName('utm_northing');
					var utc = plots.fieldByName('utc');
					var stakeDeviation = plots.fieldByName('stake_deviation');
					var distanceDeviation = plots.fieldByName('distance_deviation');
					var comments = plots.fieldByName('comments');
					var plotID = plots.fieldByName('plot_id');
					
					db.execute('INSERT INTO plot (plot_id, plot_name, utm_zone, utm_easting, utm_northing, utc, stake_deviation, distance_deviation, \
						transect_id, comments) VALUES (?,?,?,?,?,?,?,?,?,?)', plotID, plotName, plotUtmZone, plotUtmEasting, plotUtmNorthing,
						utc, stakeDeviation, distanceDeviation, transectID, comments);
	
					// Get any plot observations associated with the plot
					var observations = db.execute('SELECT * FROM plot_observation WHERE plot_id = ?', plotID);
					
					// Copy and associate any existing plot observations
					while (observations.isValidRow()){
						var observationID = uuid.generateUUID();
						var observation = observations.fieldByName('observation');
						var groundCover = 0;
						var count = observations.fieldByName('count');
						var observationComments = observations.fieldByName('comments');
					
						db.execute('INSERT INTO plot_observation (observation_id, observation, ground_cover, count, comments, plot_id) \
							VALUES (?,?,?,?,?,?)', observationID, observation, groundCover, count, observationComments, plotID);
						
						observations.next();
					}	
					plots.next();
				}
				transects.next();
			}
			//observations.close();
			//plots.close();
			//transects.close();
		}
				
	} catch (e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		//protocolResult.close();
		//parkResult.close();
		db.close();
		Ti.App.fireEvent("app:refreshSiteSurveys");
		$.addSiteSurveyWin.close();
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
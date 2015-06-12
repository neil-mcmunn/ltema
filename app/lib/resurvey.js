var uuid = require('uuid');

function getOldSurvey(guid) {
	try{
		console.log('enter getOldSurvey');
		
		var db = Ti.Database.open('ltemaDB');
	
		//Query - Select metadata for the survey being uploaded
		var metaRows = db.execute( 'SELECT * FROM site_survey WHERE site_survey_guid = ?', guid);

		var year = new Date().getFullYear().toString();
		var survey = {
			transects : [],
			plots : [],
			plot_observations : [],
			survey_meta : {
				site_survey_guid : guid,
				protocol : metaRows.fieldByName('protocol_id'),
				park : metaRows.fieldByName('park_id'),
				version_no : metaRows.fieldByName('version_no'),
				date_surveyed : year
			}
		};
		
		// start building survey and mediaIDs objects
		var transectRows = db.execute( 'SELECT * FROM transect WHERE site_survey_guid = ?', guid);
		
		while(transectRows.isValidRow()){
			var transect = {
				transect_guid: transectRows.fieldByName('transect_guid'),
				transect_name: transectRows.fieldByName('transect_name'),
				plot_distance: transectRows.fieldByName('plot_distance'),
				stake_orientation: transectRows.fieldByName('stake_orientation'),
				utm_zone: transectRows.fieldByName('utm_zone'),
				utm_easting: transectRows.fieldByName('utm_easting'),
				utm_northing: transectRows.fieldByName('utm_northing'),
				site_survey_guid: transectRows.fieldByName('site_survey_guid'),
			};
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
				};
				survey.plots.push(plot);

				var observationRows = db.execute('SELECT * FROM plot_observation WHERE plot_guid = ?', plot.plot_guid); 
				
				while(observationRows.isValidRow()){
					var observation = {
						plot_observation_guid: observationRows.fieldByName('plot_observation_guid'),
						observation: observationRows.fieldByName('observation'),
						count: observationRows.fieldByName('count'),
						plot_guid: observationRows.fieldByName('plot_guid'),
						species_code: observationRows.fieldByName('species_code')
					};
					survey.plot_observations.push(observation);
					
					observationRows.next();
				}
				plotRows.next();
			}
			transectRows.next();
		}

	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally{
		db.close();
		deleteOldSurvey(survey, guid);
	}
}

//delete old data associated with survey
function deleteOldSurvey(survey, guid) {
	try {		
		console.log('enter deleteOldSurvey');
		var db = Ti.Database.open('ltemaDB');
		
		var testDelete = db.execute('SELECT transect_guid FROM transect t, site_survey s WHERE t.site_survey_guid = s.site_survey_guid AND t.site_survey_guid = ?', guid);
		var tGUID = testDelete.fieldByName('transect_guid');
		console.log('transect GUID before delete: ' + tGUID);

		db.execute('DELETE FROM site_survey WHERE site_survey_guid = ?', guid);
		
		var testDeleteAfter = db.execute('SELECT transect_guid FROM transect WHERE transect_guid = ?', tGUID);
		var tGUIDAfter = testDeleteAfter.fieldByName('transect_guid');
		console.log('transect GUID after delete: ' + tGUIDAfter);

	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally{
		db.close();
		insertNewSurvey(survey); 
	}
}

function insertNewSurvey(survey) {
	console.log('enter insertNewSurvey');
	
   	try {
    	var db = Ti.Database.open('ltemaDB');
    	
    	console.log(survey);
    	
    	var transectRows = survey.transects;
    	var plotRows = survey.plots;
    	var plotObservationRows = survey.plot_observations;
    	var oldSurveyMeta = survey.survey_meta;
    	
	    var protocolID = oldSurveyMeta.protocol;
	    var parkID = oldSurveyMeta.park;
	    var versionNo = 1; // reset to 1 for new survey
	    var year = new Date().getFullYear().toString();
	    var newGUID = uuid.generateUUID();
	    
		db.execute('INSERT INTO site_survey (site_survey_guid, year, protocol_id, park_id, version_no) VALUES (?,?,?,?,?)', 
											newGUID, year, protocolID, parkID, versionNo);

		
		console.log('insert new values: ' + protocolID + ' ' + year + ' ' + newGUID);
		// Copy and associate any existing transects
		for (var i = 0; i < transectRows.length; i++) {

			var transectGUID = uuid.generateUUID();
			var transectName = transectRows[i].transect_name;
			var plotDistance = transectRows[i].plot_distance;
			var stakeOrientation = transectRows[i].stake_orientation;
			var utmZone = transectRows[i].utm_zone;
			var utmEasting = transectRows[i].utm_easting;
			var utmNorthing = transectRows[i].utm_northing;
	
			db.execute('INSERT INTO transect (transect_guid, transect_name, plot_distance, stake_orientation, utm_zone, \
				utm_easting, utm_northing, site_survey_guid) VALUES (?,?,?,?,?,?,?,?)', 
				transectGUID, transectName, plotDistance, stakeOrientation, utmZone, utmEasting, utmNorthing, newGUID);
			
			// Copy and associate any existing plots
			for (var j = 0; j < plotRows.length; j++) {
				
				var plotGUID = uuid.generateUUID();
				var plotName = plotRows[j].plot_name;
				var plotUtmZone = plotRows[j].utm_zone;
				var plotUtmEasting = plotRows[j].utm_easting;
				var plotUtmNorthing = plotRows[j].utm_northing;
				var utc = plotRows[j].utc;
				var stakeDeviation = plotRows[j].stake_deviation;
				var distanceDeviation = plotRows[j].distance_deviation;

				db.execute('INSERT INTO plot (plot_guid, plot_name, utm_zone, utm_easting, utm_northing, utc, stake_deviation, \
					distance_deviation, transect_guid) VALUES (?,?,?,?,?,?,?,?,?)', plotGUID, plotName, plotUtmZone, 
					plotUtmEasting, plotUtmNorthing, utc, stakeDeviation, distanceDeviation, transectGUID);
					
				// Copy and associate any existing plot observations
				for (var k = 0; k < plotObservationRows.length; k++) {

					var observationGUID = uuid.generateUUID();
					var observation = plotObservationRows[k].observation;
					var groundCover = 0;
					var count = 0;
					var plotObsOldMediaID = plotObservationRows[k].media_id;
					var speciesCode = plotObservationRows[k].species_code;
				
					db.execute('INSERT INTO plot_observation (plot_observation_guid, observation, ground_cover, count, plot_guid, species_code) \
						VALUES (?,?,?,?,?,?)', observationGUID, observation, groundCover, count, plotGUID, speciesCode);
				}
			}	
		}
		
		// var test = db.execute('select s.site_survey_guid, t.transect_guid, p.plot_guid, po.plot_observation_guid \
								// from site_survey s, transect t, plot p, plot_observation po \
								// where s.site_survey_guid = t.site_survey_guid \
								// and t.transect_guid = p.transect_guid \
								// and p.plot_guid = po.plot_guid\
								// and s.site_survey_guid = ?', newGUID);
// 								
		// var testArray = [];
		// while (test.isValidRow()) {
			// var s = test.fieldByName('site_survey_guid');
			// var t = test.fieldByName('transect_guid');
			// var p = test.fieldByName('plot_guid');
			// var po = test.fieldByName('plot_observation_guid');
// 			
			// var results = {'site':s, 'transect':t, 'plot':p, 'plobs':po}; 
// 			
			// testArray.push(results);
		// }
// 		
		// console.log ('test array insert resurvey');
		// console.log(testArray);
	} catch (e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		Ti.App.fireEvent("app:refreshSiteSurveys");
	}
}

exports.resurvey = getOldSurvey;
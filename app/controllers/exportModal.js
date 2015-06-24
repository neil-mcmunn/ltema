/*
 * Transfer completed site surveys to a desktop computer via physical connection
 */

//Navigation Bar label
var titleText = "Export a Survey";
var titleLabel = Titanium.UI.createLabel({
	text: titleText,
	font:{fontSize:20,fontWeight:'bold'},
});
$.exportWin.setTitleControl(titleLabel);

// User Instructions
var instructions = "";

if (Ti.App.Properties.getString('auth_level') != 9) {
	instructions += 
		"As a Field Officer, please use the 'Upload' function instead of 'Export' when submitting surveys " +
		"whenever possible. 'Upload' will automatically inform the Supervisor that your survey is complete.\n\n";
}	
instructions += 
	"Please press the Select button above.\n\n" + 
	"Use the picker below to select the Site Survey you wish to prepare for export and press Done.\n\n" +
	"Press the Export button and wait for the confirmation that the Survey is ready for export.\n\n" +
	"You can now connect your device to iTunes to retrieve the Survey folder.\n\n";
$.info.text = instructions;

function backBtnClick(){
	Ti.App.fireEvent("app:enableIndexExportButton");
	$.modalNav.close();
}

function surveyBtn() {
	$.formView.opacity = .2;
	$.surveyPkrView.visible = true;
}

function doneSelectBtn() {
	$.selectLbl.text = $.surveyPkr.getSelectedRow(0).title;
	$.formView.opacity = 1;
	$.surveyPkrView.visible = false;
	if ($.selectLbl.text != "Select") {
		$.exportBtn.enabled = true;
	}
}

// Query the database based for site surveys that are eligable for export
// A site survey must have at least 1 transect with 1 plot with 1 observation before it can be exported
try {
	var db = Ti.Database.open('ltemaDB');
	
	var rows = db.execute('SELECT svy.site_id, svy.site_survey_guid, prk.park_name, svy.year, pro.protocol_name \
		FROM site_survey svy, park prk, protocol pro, transect tst, plot plt, plot_observation pob \
		WHERE svy.park_id = prk.park_id AND \
		svy.protocol_id = pro.protocol_id AND \
		svy.site_survey_guid = tst.site_survey_guid AND \
		tst.transect_guid = plt.transect_guid AND \
		plt.plot_guid = pob.plot_guid \
		GROUP BY svy.site_id');
	
	// Create a picker row for each site survey that can be exported
	var data = [];
	var index = 0;
	while (rows.isValidRow()) {	
		
		var siteGUID = rows.fieldByName('site_survey_guid');
		var year = rows.fieldByName('year');
		var protocolName = rows.fieldByName('protocol_name');
		var parkName = rows.fieldByName('park_name');
		
		// Build the picker row title
		var siteSurvey = year + ' - ' + protocolName + ' - ' + parkName; 
		
		// Create a new picker row
		var newRow = Ti.UI.createPickerRow({
			title : siteSurvey,
			siteGUID : siteGUID
		});
		
		data[index] = newRow;
		index ++;
		rows.next();
	}
	
	// Add the rows to the picker
	if (data.length > 0) {
		$.surveyPkr.add(data);
		$.selectLbl.text = "Select";
		$.selectLbl.addEventListener('click', surveyBtn);
	} else {
		$.selectLbl.text = "Please complete a survey before exporting";
		$.info.text = "Please complete a survey before exporting.\n\n";
	}
	
} catch (e) {
	var errorMessage = e.message;
	Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
} finally {
	db.close();
}


// Create the CSV files for the Site Survey selected for export
function makeCSV(survey, guid) {
	//var siteGUID = $.surveyPkr.getSelectedRow(0).siteGUID;
	var siteGUID = guid;
	// var siteName = $.surveyPkr.getSelectedRow(0).title;
	
	try{
		var db = Ti.Database.open('ltemaDB');
		
		var protocolRow = db.execute('SELECT protocol_name FROM protocol WHERE protocol_id = ?', survey.survey_meta.protocol);
		var parkRow = db.execute('SELECT park_name FROM park WHERE park_id = ?', survey.survey_meta.park);
		
		var protocolName = protocolRow.fieldByName('protocol_name');
		var parkName = parkRow.fieldByName('park_name');
		
	} catch (e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
	}
	console.log('export line 117: ' + parkName);
	
	// Prepare the CSV files
	
	var nl = '\n';
	var c = ',';
	var dq = '"';
	// var sampleStationTxt = 	dq + 'Transect Name' + dq + c +
							// dq + 'Plot Name' + dq + c + 
							// dq + 'UTM ZONE' + dq + c +
							// dq + 'UTM EASTING' + dq + c + 
							// dq + 'UTM NORTHING' + dq + c + 
							// dq + 'Image Name' + dq + nl;
							
	var sampleStationTxt = 	dq + 'Study Area Name' + dq + c +
							dq + 'Sample Station Label' + dq + c + 
							dq + 'UTM Zone Sample Station' + dq + c +
							dq + 'Easting Sample Station' + dq + c + 
							dq + 'Northing Sample Station' + dq + nl;
							
	// var generalSurveyTxt = 	dq + 'Park Name' + dq + c +
							// dq + 'Transect/Plot Name' + dq + c + 
							// dq + 'Date' + dq + c +
							// dq + 'Time' + dq + c +
							// dq + 'Surveyor' + dq + c + 
							// dq + 'Species' + dq + c + 
							// dq + 'Count' + dq + c + 
							// dq + 'Comment' + dq + c + 
							// dq + 'Ground Cover' + dq + c + 
							// dq + 'Image' + dq + nl;
							
	var generalSurveyTxt = 	dq + 'Study Area Name' + dq + c +
							dq + 'Sample Station Label' + dq + c + 
							dq + 'Date' + dq + c +
							dq + 'Time' + dq + c +
							dq + 'End Time' + dq + c +
							dq + 'Surveyor' + dq + c + 
							dq + 'Species' + dq + c + 
							dq + 'Count' + dq + c + 
							dq + 'UTM Zone' + dq + c + 
							dq + 'Easting' + dq + c + 
							dq + 'Northing' + dq + c + 
							dq + 'Comments' + dq + c + 
							dq + '% foliar cover' + dq + nl;
	
	//console.log(survey);
	
	var transects = survey.transects;
	var plots = survey.plots;
	var plotObs = survey.plot_observations;
	
	try {
		var db = Ti.Database.open('ltemaDB');
		
		for (var i = 0, iLen = transects.length; i < iLen; i++) {
			var transectGUID = transects[i].transect_guid;
			
			for (var j = 0, jLen = plots.length; j < jLen; j++) {
				var plotGUID = plots[j].plot_guid;
				
				if (transectGUID === plots[j].transect_guid) {
					sampleStationTxt += dq + parkName + dq + c;
					var ssTransectName = transects[i].transect_name;
					if (ssTransectName != null) {
						ssTransectName = ssTransectName.replace(/\"/g, "");
					}
					sampleStationTxt += dq + ssTransectName + " - ";
					
					sampleStationTxt += plots[j].plot_name + dq + c;
					sampleStationTxt += dq + plots[j].utm_zone + dq + c;
					sampleStationTxt += dq + plots[j].utm_easting + dq + c;
					sampleStationTxt += dq + plots[j].utm_northing + dq + c;
					
					var plotMedia = db.execute('SELECT media_name FROM media m, plot p WHERE m.media_id = p.media_id AND p.plot_guid = ?', plotGUID);
					var mediaName = plotMedia.fieldByName('media_name');
					sampleStationTxt += dq + mediaName + dq + nl;
					
				} else {
					continue;
				}
				
				for (var k = 0, kLen = plotObs.length; k < kLen; k++) {
					
					if (plotGUID === plotObs[k].plot_guid) {
						var plotObsGUID = plotObs[k].plot_observation_guid;
						//skip entry if ground cover is 0
						if (plotObs[k].ground_cover === 0) {
							continue;
						}
						
						// Convert utc to date and time
						var utc = parseInt(plots[j].utc);
						var d = new Date(utc);
						
						var date = d.toDateString().split(" ");
						var plotDate = dq + date[2] + date[1] + date[3] + dq;
						
						var time = d.toTimeString().split(":");
						var plotTime = dq + time[0] + ":" + time[1] + dq;
						var plotEndTime = '';
						
						// CSV for General Survey output
						generalSurveyTxt += dq + parkName + dq + c;
						
						var gsTransectName = transects[i].transect_name;
						if (gsTransectName != null) {
							gsTransectName = gsTransectName.replace(/\"/g, "");
						}
						generalSurveyTxt += dq + gsTransectName + " - ";
						
						generalSurveyTxt += plots[j].plot_name + dq + c;
						generalSurveyTxt += plotDate + c + plotTime + c + plotEndTime + c;
						
						var surveyor = transects[i].surveyor;
						if (surveyor != null) {
							surveyor = surveyor.replace(/\"/g, "");
						}
						generalSurveyTxt += dq + surveyor + dq + c;
						
						var speciesCode = plotObs[k].species_code;
						if (speciesCode != null) {
							speciesCode = speciesCode.replace(/\"/g, "");
						}
						generalSurveyTxt += dq + speciesCode + dq + c;
						
						generalSurveyTxt += dq + plotObs[k].count + dq + c;
						// utm zone, easting, northing
						generalSurveyTxt += dq + plots[j].utm_zone + dq + c;
						generalSurveyTxt += dq + plots[j].utm_easting + dq + c;
						generalSurveyTxt += dq + plots[j].utm_northing + dq + c;
						
						var comments = plotObs[k].comments;
						if (comments != null) {
							comments = comments.replace(/\"/g, "");
						}
						generalSurveyTxt += dq + comments + dq + c;
						
						generalSurveyTxt += dq + plotObs[j].ground_cover + dq + c;
						
						var plotObsMedia = db.execute('SELECT media_name FROM media m, plot_observation p WHERE m.media_id = p.media_id AND p.plot_observation_guid = ?', plotObsGUID);
						var observationPhoto = plotObsMedia.fieldByName('media_name');
						if (observationPhoto != null) {
							generalSurveyTxt += dq + observationPhoto + dq + nl;
						} else {
							generalSurveyTxt += nl;
						}
					
					} else {
						continue;
					}
				}
			}
		}
	} catch (e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
	}
	
	
	
	/*for (var transect in results) {
		console.log('exportModal line 204');
		console.log(transect);
		console.log(results.length);
		for (var plot in results[transect]) {
			console.log('exportModal line 207');
			console.log(results[transect]);
			console.log('plot: ' + plot);
			// CSV for Sample Station output
						
			if (results[transect][plot].plot_guid != null) {
				
				sampleStationTxt += dq + results[transect].park_name + dq + c;
				var ssTransectName = results[transect].transect_name;
				if (ssTransectName != null) {
					ssTransectName = ssTransectName.replace(/\"/g, "");
				}
				sampleStationTxt += dq + ssTransectName + " ";
				
				sampleStationTxt += results[transect][plot].plot_name + dq + c;
				sampleStationTxt += dq + results[transect][plot].utm_zone + dq + c;
				sampleStationTxt += dq + results[transect][plot].utm_easting + dq + c;
				sampleStationTxt += dq + results[transect][plot].utm_northing + dq + c;
				sampleStationTxt += dq + results[transect][plot].plot_photo + dq + nl;
			}		
			
			for (var observation in results[transect][plot]) {
				if (typeof results[transect][plot][observation] === 'object' && results[transect][plot][observation] != null) {
					
					// Skip the entry if the ground cover is 0
					if (results[transect][plot][observation].ground_cover == 0) {
						continue;
					}
					
					// Convert utc to date and time
					var utc = parseInt(results[transect][plot].utc);
					var d = new Date(utc);
					
					var date = d.toDateString().split(" ");
					var plotDate = dq + date[2] + date[1] + date[3] + dq;
					
					var time = d.toTimeString().split(":");
					var plotTime = dq + time[0] + ":" + time[1] + dq;
					
					// CSV for General Survey output
					generalSurveyTxt += dq + results[transect].park_name + dq + c;
					
					var gsTransectName = results[transect].transect_name;
					if (gsTransectName != null) {
						gsTransectName = gsTransectName.replace(/\"/g, "");
					}
					generalSurveyTxt += dq + gsTransectName + " ";
					
					generalSurveyTxt += results[transect][plot].plot_name + dq + c;
					generalSurveyTxt += plotDate + c + plotTime + c + c;
					
					var surveyor = results[transect].surveyor;
					if (surveyor != null) {
						surveyor = surveyor.replace(/\"/g, "");
					}
					generalSurveyTxt += dq + surveyor + dq + c;
					
					var speciesCode = results[transect][plot][observation].species_code;
					if (speciesCode != null) {
						speciesCode = speciesCode.replace(/\"/g, "");
					}
					generalSurveyTxt += dq + speciesCode + dq + c;
					
					generalSurveyTxt += dq + results[transect][plot][observation].count + dq + c + c + c + c;
					
					var comments = results[transect][plot][observation].comments;
					if (comments != null) {
						comments = comments.replace(/\"/g, "");
					}
					generalSurveyTxt += dq + comments + dq + c;
					
					generalSurveyTxt += dq + results[transect][plot][observation].ground_cover + dq + c;
					
					var observationPhoto = results[transect][plot][observation].observation_photo;
					if (observationPhoto != null) {
						generalSurveyTxt += dq + observationPhoto + dq + nl;
					} else {
						generalSurveyTxt += nl;
					}
				}					
			}
		}
	}*/

	// Create the CSV files
	try{
		//Name the directory
		var dir = $.surveyPkr.getSelectedRow(0).title;
				
		// Create Directory for site
		var siteDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
		if (! siteDir.exists()) {
			siteDir.createDirectory();
		}
		
		// Create Sample Station file
		var ssFileName = "SampleStation.csv";
		var sampleStationFile = Titanium.Filesystem.getFile(siteDir.resolve(), ssFileName);
		sampleStationFile.write(sampleStationTxt); 
		
		// Create General Survey file
		var gsFileName = "GeneralSurvey.csv";
		var generalSurveyFile = Titanium.Filesystem.getFile(siteDir.resolve(), gsFileName);
		generalSurveyFile.write(generalSurveyTxt);
	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:fileSystemError", {error: errorMessage});
	} finally {
		// Dispose of file handles
		siteDir = null;
		sampleStationFile = null;
		generalSurveyFile = null;
	}
}

function exportBtn() {
	// Create the CSV and export all files and photos
	//makeCSV();
	
	var exp = require('upload');
	var siteGUID = $.surveyPkr.getSelectedRow(0).siteGUID;
	exp.getExportData(siteGUID, makeCSV);

	$.exportWin.fireEvent("doneSending");
}

// All the HTTP requests have sent successfully
$.exportWin.addEventListener("doneSending", function() { 
	try{
		var db = Ti.Database.open('ltemaDB');
		var siteGUID = $.surveyPkr.getSelectedRow(0).siteGUID;
		var d = new Date();
		var utc = d.getTime();
		
		// Timestamp the export in the database
		db.execute('UPDATE OR FAIL site_survey SET exported = ? WHERE site_survey_guid = ?', utc, siteGUID);
	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:fileSystemError", {error: errorMessage});
	} finally {
		db.close();
		alert("Data for " + $.surveyPkr.getSelectedRow(0).title + " is ready for export");
	} 
});

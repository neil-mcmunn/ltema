// Files to be uploaded to server
var serverAddress = "http://ltema.breakerarts.com/uploadfile.php";

function backBtnClick(){
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
	
	var rows = db.execute('SELECT svy.site_id, prk.park_name, svy.year, pro.protocol_name \
		FROM site_survey svy, park prk, protocol pro, transect tst, plot plt, plot_observation pob \
		WHERE svy.park_id = prk.park_id AND \
		svy.protocol_id = pro.protocol_id AND \
		svy.site_id = tst.site_id AND \
		tst.transect_id = plt.transect_id AND \
		plt.plot_id = pob.plot_id \
		GROUP BY svy.site_id');
	
	// Create a picker row for each site survey that can be exported
	var data = [];
	var index = 0;
	while (rows.isValidRow()) {	
		
		var siteID = rows.fieldByName('site_id');
		var year = rows.fieldByName('year');
		var protocolName = rows.fieldByName('protocol_name');
		var parkName = rows.fieldByName('park_name');
		
		// Build the picker row title
		var siteSurvey = year + ' - ' + protocolName + ' - ' + parkName; 
		
		// Create a new picker row
		var newRow = Ti.UI.createPickerRow({
			title : siteSurvey,
			siteID : siteID
		});
		
		data[index] = newRow;
		index ++;
		rows.next();
	}

	// Add the rows to the picker
	$.surveyPkr.add(data);
	
} catch (e) {
	Ti.App.fireEvent("app:dataBaseError", e);
} finally {
	rows.close();
	db.close();
}

// Create the CSV files for the Site Survey selected for export
function makeCSV() {
	var siteID = $.surveyPkr.getSelectedRow(0).siteID;
	var siteName = $.surveyPkr.getSelectedRow(0).title;
	var allFiles = [];
	
	try{
		// Query the database based on the siteID selected
		var db = Ti.Database.open('ltemaDB');
		
		/*
		var rows = db.execute('SELECT prk.park_name, tct.transect_name, plt.plot_name, \
		   plt.utm_zone, plt.utm_easting, plt.utm_northing, plt.stake_deviation, \
		   plt.distance_deviation, plt.utc, tct.surveyor, pob.observation, pob."count", pob.comments, pob.ground_cover, \
		   (SELECT media_name FROM media, transect WHERE transect.media_id = media.media_id) AS transect_photo, \
		   (SELECT media_name FROM media, plot WHERE plot.media_id = media.media_id) AS plot_photo, \
		   (SELECT media_name FROM media, plot_observation WHERE plot_observation.media_id = media.media_id) AS observation_photo \
		   FROM park prk, transect tct, plot plt, plot_observation pob, site_survey svy, media med \
		   WHERE svy.park_id = prk.park_id AND \
		   svy.site_id = tct.site_id AND \
		   tct.media_id = med.media_id AND \
		   tct.transect_id = plt.transect_id AND \
		   plt.media_id = med.media_id AND \
		   plt.plot_id = pob.plot_id AND \
		   svy.site_id = ?', siteID);
		*/
		var results = [];
		
		// Get the transects for the site
		var transects = db.execute('SELECT tct.transect_id, tct.transect_name, tct.surveyor, med.media_name AS transect_photo \
			FROM transect tct, media med \
			WHERE tct.media_id = med.media_id AND \
			tct.site_id = ?', siteID);
		
		var fieldCount = transects.fieldCount();
		var transectIDs = [];
		while (transects.isValidRow()) {
			// Get the pictures to upload
			allFiles.push(transects.fieldByName('transect_photo'));
			
			// Get the transectIDs
			transectIDs.push(transects.fieldByName('transect_id'));
			
			var row = {};
			for (var j = 0; j < fieldCount; j++) {
				row[transects.getFieldName(j)] = transects.field(j);
			}
			results.push(row);
			
			transects.next();
		}

		// Get the plots for the transects		
		var tids = '(' + transectIDs + ')';
		var plots = db.execute('SELECT plt.plot_id, plt.plot_name, plt.utm_zone, plt.utm_easting, plt.transect_id, \
			plt.utm_northing, plt.stake_deviation, plt.distance_deviation, plt.utc, med.media_name AS plot_photo\
			FROM plot plt, media med \
			WHERE plt.media_id = med.media_id AND \
			plt.transect_id IN ' + tids);
		
		fieldCount = plots.fieldCount();
		var plotIDs = [];
		while (plots.isValidRow()) {
			// Get the pictures to upload
			allFiles.push(plots.fieldByName('plot_photo'));
			
			// Get the plotIDs
			plotIDs.push(plots.fieldByName('plot_id'));
			
			
			var row = {};
			for (var j = 0; j < fieldCount; j++) {
				row[plots.getFieldName(j)] = plots.field(j);
			}
			
			for (var i in results) {
				
				if (results[i].transect_id === row.transect_id) {
					var plotName = plots.fieldByName('plot_name');
					results[i][plotName] = row;
				}
			}
			
			plots.next();
		}
		
		// Get the plot observations for the plots
		var pids = '(' + plotIDs + ')';
		var plotObservations = db.execute('SELECT pob.observation_id, pob."count", pob.comments, pob.plot_id, pob.ground_cover, med.media_name AS observation_photo \
			FROM plot_observation pob, media med \
			WHERE pob.media_id = med.media_id AND \
			pob.plot_id IN '+ pids);
		
		fieldCount = plotObservations.fieldCount();	
		while (plotObservations.isValidRow()) {
			// Get the pictures to upload
			allFiles.push(plotObservations.fieldByName('observation_photo'));
			
			var row = {};
			for (var j = 0; j < fieldCount; j++) {
				row[plotObservations.getFieldName(j)] = plotObservations.field(j);
			}
						
			for (var i in results) {
				for(var j in results[i]) {				
					if(results[i][j].plot_id === row.plot_id) {
						var pobid = plotObservations.fieldByName('observation_id');
						results[i][j][pobid] = row;
					}
				}
			}
			plotObservations.next();
		}		
	} catch(e) {
		//Ti.APP.error(e);
		Ti.App.fireEvent("app:dataBaseError", e);
	} finally {
		transects.close();
		plots.close();
		plotObservations.close();
		db.close();
		Ti.API.info("everything closed");
	}
	
	//TODO: more to fix
	return;
	
	/*
	var ssName = '"' + rows.fieldByName('transect_name') + ' ' + rows.fieldByName('plot_name') + '"' ;
	results[index]['sampleStationName'] = ssName;
	
	if(fields[i] === 'utc') {
   		results[index][fields[i]] = rows.fieldByName(fields[i]);
   		continue;
   	}
	*/
	
	
	// Prepare the CSV files
	var sampleStationTxt = "";
	var generalSurveyTxt = "";
	var nl = '\n';
	var c = ',';
	
	for (var i=0; i < results.length; i++) {
		// CSV for Sample Station output
		sampleStationTxt += results[i].park_name + c + results[i].sampleStationName + c +
			results[i].utm_zone + c + results[i].utm_easting + c + results[i].utm_northing + 
			c + results[i].plot_photo + nl;
		
		// Convert utc to date and time
		var utc = parseInt(results[i].utc);
		var d = new Date(utc);
		
		var date = d.toDateString().split(" ");
		var plotDate = '"' + date[2] + date[1] + date[3] + '"';
		
		var time = d.toTimeString().split(":");
		var plotTime = '"' + time[0] + ":" + time[1] + '"';
				
		// CSV for General Survey output
		generalSurveyTxt += results[i].park_name + c + results[i].sampleStationName + c +
			plotDate + c + plotTime + c + c + results[i].surveyor + c + results[i].observation +
			c + results[i].count + c + c + c + c + results[i].comments + c + results[i].ground_cover +
			c + results[i].observation_photo + nl;		
	}
 	
    // Create the CSV files
    try{
    	var dir = "site" + siteID;
				
		// Create Directory for site
		var siteDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
		if (! siteDir.exists()) {
	    	siteDir.createDirectory();
		}
    	
	    var ssFileName = "SampleStation.csv";
	    var sampleStationFile = Titanium.Filesystem.getFile(siteDir.resolve(), ssFileName);
	    sampleStationFile.write(sampleStationTxt); 
	    allFiles.push(ssFileName);
	    
	    var gsFileName = "GeneralSurvey.csv";
	    var generalSurveyFile = Titanium.Filesystem.getFile(siteDir.resolve(), gsFileName);
	    generalSurveyFile.write(generalSurveyTxt);
	    allFiles.push(gsFileName);
	} catch(e) {
		Ti.App.fireEvent("app:fileSystemError", e);
	} finally {
		return allFiles;
	}
}

function exportBtn() {
	// Create the CSV and export all files and photos
	var files = makeCSV();

	// Setup the progress bar
	$.progressBar.hide();
	$.progressBar.message = "Uploading...";
	$.progressBar.min = 0;
	//$.progressBar.max = files.length;
	$.progressBar.value = 0;
	$.progressBar.show();
	
	// Upload all the files for selected survey
	//TODO:exportFiles(files);	
}

// Upload a single file to the server
function exportFiles(toExport) {
	var siteID = $.surveyPkr.getSelectedRow(0).siteID;
	var dir = 'site' + siteID + '/';
	var didNotSend = [];
	var doesNotExist = [];
	var sentSuccessfully = [];
	for (var i=0; i < toExport.length; i++) {
		var fileName = toExport[i];
		
		var folderName = $.surveyPkr.getSelectedRow(0).title;
		// Open the file
		try {
			var fileToExport = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, dir + fileName);
			
			// Check if the file you are trying to upload exists
			if (!fileToExport.exists()) {
				doesNotExist.push(fileName);
				Ti.API.error(fileName + " does not exist");
				$.progressBar.value ++;
				continue;
			}
		} catch(e) {
			Ti.App.fireEvent("app:fileSystemError", e);
		}
		
		// Send the file to the server
		try {
			var data_to_send = { 
			    "file": fileToExport.read(),
			    "path": folderName
			};
			xhr = Titanium.Network.createHTTPClient();
			xhr.open("POST", serverAddress);
			xhr.setRequestHeader("enctype", "multipart/form-data");
			xhr.setRequestHeader('User-Agent','My User Agent');
			xhr.send(data_to_send);
			
			// Check the response
			xhr.onload = function() {
			    
			    // TODO: mark the file as being uploaded successfully
			    if(this.responseText === "success") {
			    	
			    	//Update the progress
			    	$.progressBar.value ++;
			    	sentSuccessfully.push(fileName);
			    	
			    	//If the last file uplaoded, we are done
			    	if ($.progressBar.value === (toExport.length)) {
			    		$.exportWin.fireEvent("doneSending", {
			    			sent: sentSuccessfully,
			    			failed: didNotSend,
			    			error: doesNotExist
			    		});
			    	}
			    } else {
			    	//$.progressBar.value ++;
			    	didNotSend.push(fileName);
			    	Ti.API.info(fileName + " did not send");
			    	Ti.API.info(this.respnoseText);
			    }
			};
			
		} catch(e) {
			Ti.App.fireEvent("app:fileSystemError", e);
		}
	}
	
}

var retrys = 0;
// All the HTTP requests have responded
$.exportWin.addEventListener("doneSending", function(e) {
    // Try resending any failed files
    if (e.failed.length > 0 && retrys < 3) {
    	Ti.APP.info("resending " + e.failed.length + " files");
    	exportFiles(e.failed);
    	retrys++;
    	return;
    }
    
    //TODO: handle if retrys failed
    
    if (e.error.length > 0) {
    	alert("There was a problem with some images\n Please re-take the following photos and try again:\n" + e.error);
    	return;
    }
    
    // TODO: if every file uploaded, mark the Site Survey as uploaded
    $.progressBar.message = "Done";
    alert("Data for " + $.surveyPkr.getSelectedRow(0).title + " has been submited"); 
});

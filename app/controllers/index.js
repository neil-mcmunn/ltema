/*
 *  List screen to view, add, or delete site surveys
 *
 */

//Run these two commands to reset db if testing delete functions
//var yourDb = Titanium.Database.open('ltemaDB');
//yourDb.remove();
//Initially remove the event that triggers the GPS location to be continuously captured

Ti.Geolocation.removeEventListener('location', function(e) {});

//Prompt the user to allow applicaiton to use location services
Titanium.Geolocation.getCurrentPosition(function(e) {});

var uie = require('UiElements');
var indicator = uie.createIndicatorWindow();

var networkIsOnline, networkType;
if (Ti.App.Properties.getString('secret')) {
	$.login.title = "Logout";
} else {
	$.login.title = "Login";
}


checkSurveys();

function checkSurveys() {
	// check for network
	if (Titanium.Network.networkType == Titanium.Network.NETWORK_NONE){
		var alertDialog = Titanium.UI.createAlertDialog({
			title: 'WARNING!',
			message: 'Your device is not online.',
			buttonNames: ['OK']
		});
		alertDialog.show();

		var cloudSurveys = [];
		checkLocalSurveys(cloudSurveys);

	} else {
		try {
			networkIsOnline = true;
			
			var url = "https://capstone-ltemac.herokuapp.com/surveys";
			var httpClient = Ti.Network.createHTTPClient();
			httpClient.open("GET", url);
			httpClient.setRequestHeader('secret', Ti.App.Properties.getString('secret'));
			httpClient.setRequestHeader('Content-Type', 'application/json');

			httpClient.onload = function() {
				//call checkLocalSurveys, pass in results
				Ti.API.info("Received text (index L39): " + this.responseData);
				var returnArray = JSON.parse(this.responseData).rows;
				checkLocalSurveys(returnArray);
			};
			httpClient.onerror = function(e) {
				Ti.API.debug("STATUS: " + this.status);
				Ti.API.debug("TEXT:   " + this.responseText);
				Ti.API.debug("ERROR:  " + e.error);
				var cloudSurveys = [];
				checkLocalSurveys(cloudSurveys);
				if (this.status === 400) {
					alert('please login');
				} else {
					alert('error retrieving survey list, server offline');
				}
			};

			httpClient.send();
		}
		catch (e) {
			var errorMessage = e.message;
			console.log('error in checkSurveys: ' + errorMessage);
		}
	}
}

function checkLocalSurveys (cloudSurveys) {
	try {
		//open database
		var db = Ti.Database.open('ltemaDB');//Query - Retrieve existing sites from sqlite database
		var rows = db.execute('SELECT site_survey_guid, year, protocol_name, park_name \
						FROM site_survey s, protocol p, park prk \
						WHERE s.protocol_id = p.protocol_id \
						AND s.park_id = prk.park_id ');

		var localSurveys = [];
		while (rows.isValidRow()){
			var protocolName = rows.fieldByName('protocol_name');
			var parkName = rows.fieldByName('park_name');
			var siteGUID = rows.fieldByName('site_survey_guid');
			var year = rows.fieldByName('year');
			var results = {'site_survey_guid' : siteGUID, 'date_surveyed' : year, 'protocol' : protocolName, 'site' : parkName};
			localSurveys.push(results);

			rows.next();
		}

		populateTable(cloudSurveys, localSurveys);

	} catch(e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		toggleEditBtn();
	}
}


function populateTable(cloudSurveys, localSurveys) {
	$.addSite.enabled = true;
	//Clear the table if there is anything in it
	var rd = [];
	$.tbl.data = rd;

	//compare cloud to local surveys and create separate lists to create buttons on
	var cloudOnlySurveys = [];
	var cloudAndLocalSurveys = [];

	// check for cloudOnly and cloudAndLocal
	for (var i = 0, len = cloudSurveys.length; i < len; i++) {
		var yearOnCloud = cloudSurveys[i].date_surveyed;
		var cloudSiteGUID = cloudSurveys[i].site_survey_guid;
		var matched = false;
		
		for (var j = 0, localLen = localSurveys.length; j < localLen; j++) {
			var localSiteGUID = localSurveys[j].site_survey_guid;
			var yearOnDevice = localSurveys[j].date_surveyed;
			
			// already downloaded
			if (cloudSiteGUID === localSiteGUID) {
				var results = {'site_survey_guid': localSiteGUID, 'date_surveyed': yearOnDevice};
				cloudAndLocalSurveys.push(results);
				matched = true;
				break;
			}
		}
		//check if there were matches 
		if (!matched) {
			// didn't match cloud to device, add to cloudOnlySurveys
			var cloudParkID = cloudSurveys[i].park_id;
			var cloudProtocolID = cloudSurveys[i].protocol_id;
			var results = {'site_survey_guid': cloudSiteGUID, 'date_surveyed': yearOnCloud, 'park_id':cloudParkID, 'protocol_id':cloudProtocolID};
			cloudOnlySurveys.push(results);
		}
	}

	//check for localOnly
	var localOnlySurveys = [];
	for (var i = 0; i < localSurveys.length; i++) {
		var localSiteGUID = localSurveys[i].site_survey_guid;
		var matched = false;
		
		for (var j = 0; j < cloudAndLocalSurveys.length; j++) {
			var cloudAndLocalSiteGUID = cloudAndLocalSurveys[j].site_survey_guid;
			// if there's a match, skip to next iteration of i
			if (cloudAndLocalSiteGUID === localSiteGUID) {
				matched = true;
				break;
			}
		}
		// if no match, add record to localOnly
		if (!matched) {
			var yearOnDevice = localSurveys[i]['date_surveyed'];
			var results = {'site_survey_guid': localSiteGUID, 'date_surveyed': yearOnDevice};
			localOnlySurveys.push(results);
		}
	}
	
	Ti.App.Properties.setString('local_surveys',localOnlySurveys);
	Ti.App.Properties.setString('downloaded_local_surveys',cloudAndLocalSurveys);
	Ti.App.Properties.setString('cloud_surveys',cloudOnlySurveys);

	createButtons(localOnlySurveys, true, true);
	createButtons(cloudAndLocalSurveys, true, true);
	createButtons(cloudOnlySurveys, false, false);
}


function createButtons(rows, isDownloaded, local) {
	try {
		var db = Ti.Database.open('ltemaDB');
		
		var superUser = false;
		if (parseInt(Ti.App.Properties.getString('auth_level')) === 9) {
			superUser = true;
		}
		
		//Get requested data from each row in table
		for (var i = 0; i < rows.length; i++) {
			var year = rows[i].date_surveyed;
			var versionNo = rows[i].version_no;
			var siteGUID = rows[i].site_survey_guid;
			
			var exp = db.execute('SELECT exported FROM site_survey WHERE site_survey_guid = ?', siteGUID);
			var exported = exp.fieldByName('exported');
		
			// get park and protocol names based on siteGUID if confirmed on device
			//    also create a new row (gray out if not downloaded)
			if (isDownloaded) {
				var protocolResults = db.execute('SELECT protocol_name FROM site_survey s, protocol p WHERE s.protocol_id = p.protocol_id AND s.site_survey_guid =?', siteGUID);
				var protocol = protocolResults.fieldByName('protocol_name');
				
				var siteResults = db.execute('SELECT park_name FROM site_survey s, park p WHERE s.park_id = p.park_id AND s.site_survey_guid =?', siteGUID);
				var site = siteResults.fieldByName('park_name');
				
				//create a string from each entry
				var siteSurvey = protocol + ' - ' + site.slice(0, 30);
				var newRow = Ti.UI.createTableViewRow({
					title: siteSurvey,
					site: site,
					siteGUID: siteGUID,
					protocol: protocol, //not visible, but passed to transects screen
					height: 60,
					font: {fontSize: 20},
					color: 'black',
					exported: false
				});
				
				if (exported && !superUser) {
					newRow.exported = true;
				}
			// otherwise use park and protocol id's from cloud
			} else {
				var protocolResults = db.execute('SELECT protocol_name FROM protocol WHERE protocol_id =?', rows[i].protocol_id);
				var protocol = protocolResults.fieldByName('protocol_name');
				
				var siteResults = db.execute('SELECT park_name FROM park WHERE park_id =?', rows[i].park_id);
				var site = siteResults.fieldByName('park_name');
				
				//create a string from each entry
				var siteSurvey = protocol + ' - ' + site.slice(0, 30);
				var newRow = Ti.UI.createTableViewRow({
					title: siteSurvey,
					site: site,
					siteGUID: siteGUID,
					protocol: protocol, //not visible, but passed to transects screen
					height: 60,
					font: {fontSize: 20},
					color: 'gray'
				});
				
				newRow.editable = false;
			}
	
			//create and add info icon for the row
			var infoButton = Ti.UI.createButton({
				backgroundImage:'icons/info.png',
				backgroundFocusedImage: 'icons/info_clicked.png',
				backgroundSelectedImage: 'icons/info_clicked.png',
				right : 15,
				height: 60,
				width: 60,
				buttonid: 'info'
			});
			var downloadButton = Ti.UI.createButton({
				backgroundImage:'icons/download.png',
				backgroundFocusedImage: 'icons/download_clicked.png',
				backgroundSelectedImage: 'icons/download_clicked.png',
				right : 75,
				height: 60,
				width: 60,
				buttonid: 'download'
			});
			
			if (exported && !superUser) {
				var uploadButton = Ti.UI.createButton({
					backgroundImage:'icons/lock.png',
					backgroundFocusedImage: 'icons/lock.png',
					backgroundSelectedImage: 'icons/lock.png',
					right : 135,
					height: 60,
					width: 60,
					buttonid: 'locked'
				});
			} else {
				var uploadButton = Ti.UI.createButton({
					backgroundImage:'icons/upload.png',
					backgroundFocusedImage: 'icons/upload_clicked.png',
					backgroundSelectedImage: 'icons/upload_clicked.png',
					right : 135,
					height: 60,
					width: 60,
					buttonid: 'upload'
				});
			}
			
			newRow.add(infoButton);
			
			if (networkIsOnline && !local) {
				newRow.add(downloadButton);
			}
			
			if (isDownloaded && networkIsOnline) {
				newRow.add(uploadButton);	
			}
						
			//Add row to the table view
			$.tbl.appendRow(newRow);
		}
	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		toggleEditBtn();
	}
	
}

/* Nav Bar Label */

// Build title label

var labelText = 'Site Surveys';

var titleLabel = Titanium.UI.createLabel({
	top:10,
	text: labelText,
	textAlign:'center',
	font:{fontSize:20,fontWeight:'bold'},
});

// Associate label to title
$.siteSurveysWin.setTitleControl(titleLabel);

//Delete event listener
$.tbl.addEventListener('delete', function(e) {
	//get the site_id of the current row being deleted
	var currentSiteGUID = e.rowData.siteGUID;
	var cloudOnly = e.rowData.color === 'gray' ? true : false;
	
	if (!cloudOnly) {
		try{
			//open database
			var db = Ti.Database.open('ltemaDB');
	
			//GET FOLDER NAME - Retrieve site survery, year, park
			var rows = db.execute('SELECT year, protocol_name, park_name \
									FROM site_survey s, protocol p, park prk \
									WHERE s.protocol_id = p.protocol_id \
									AND s.park_id = prk.park_id \
									AND site_survey_guid = ?', currentSiteGUID);
									
		   //get the name of the directory	
			var year = rows.fieldByName('year');
			var protocol = rows.fieldByName('protocol_name');
			var site = rows.fieldByName('park_name');
			
			// Delete any saved files associated with this site survey
			var dir = year + ' - ' + protocol + ' - ' + site;
			var folder = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
			if (folder.exists()) {
				// delete the folder and it's contents
				folder.deleteDirectory(true);
			}
	
			//delete current row from the database
			db.execute('DELETE FROM site_survey WHERE site_survey_guid = ?', currentSiteGUID);
	
		} catch(e) {
			var errorMessage = e.message;
			Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
		} finally {
			// Dispose of file handles and db connections
			folder = null;
			db.close();
		}
	}

	//check if Edit button should be enabled/disabled - if no rows exist
	toggleEditBtn();
});

// Table row click event
$.tbl.addEventListener('click', function(e) {
	//ignore row clicks in edit mode
	if ($.tbl.editing == true) {
		return;
	}
	//info button clicked, display modal
	if(e.source.buttonid == 'info') {
		var modal = Alloy.createController("siteSurveyModal", {siteGUID:e.rowData.siteGUID}).getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});
		//download button clicked
	} else if (e.source.buttonid == 'download') {
		//alert('Download button pressed! Calling download function with the following parameters...\n' + e.rowData.site + ' ' + e.rowData.protocol);
		var dialog = Ti.UI.createAlertDialog({
			cancel: 1,
			buttonNames: ['Confirm', 'Cancel'],
			message: 'Download ' + e.rowData.site + '?',
			title: 'Confirm Download'
	  	});
		dialog.addEventListener('click', function(f){
			if (f.index === f.source.cancel){
				Ti.API.info('The cancel button was clicked');
			} else {
				if (networkIsOnline) {
					var download = require('download');
					download.downloadSurvey(e.rowData.siteGUID);					
				} else {
					alert('network is not online');
				}
			}
		});
		dialog.show();
		
		//upload button clicked
	} else if (e.source.buttonid == 'upload') {
		//alert('Upload button pressed! Calling upload function...');
		var dialog = Ti.UI.createAlertDialog({
			cancel: 1,
			buttonNames: ['Confirm', 'Cancel'],
			message: 'Upload ' + e.rowData.site + '?',
			title: 'Confirm Upload'
	  	});
		dialog.addEventListener('click', function(f){
			if (f.index === f.source.cancel){
				Ti.API.info('The cancel button was clicked');
			} else {
				if (networkIsOnline) {
					try {
						var db = Ti.Database.open('ltemaDB');
						var t = db.execute('SELECT transect_guid FROM transect WHERE site_survey_guid = ?', e.rowData.siteGUID);
						var transectGUID = t.fieldByName('transect_guid');
						var p = db.execute('SELECT plot_guid FROM plot WHERE transect_guid = ?', transectGUID);
						var plotGUID = p.fieldByName('plot_guid');
						var o = db.execute('SELECT plot_observation_guid FROM plot_observation WHERE plot_guid = ?', plotGUID);
						var observationCount = o.rowCount;
						
						if (observationCount > 0) {
							var upload = require('upload');
							Ti.App.Properties.setString('current_row_guid', e.rowData.siteGUID);
							upload.uploadSurvey(e.rowData.siteGUID);
						} else {
							alert('the survey is too short');
						}
						
					} catch (e) {
						db.close();
						var errorMessage = e.message;
						Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
						alert('survey too short');
					}
				} else {
					alert('network is not online');
				}
			}
		});
		dialog.show();
		
	} else if (e.source.buttonid === 'locked') {
		alert('This survey cannot be edited');

		//export button clicked
	} else if (e.source.buttonid == 'export') {
		alert('Export button pressed!');

		// the following snippet is copied from exportBtn() function below
		$.exportData.enabled = false;
		var modal = Alloy.createController("exportModal").getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});

		//row clicked, get transect view
	} else {
		// if downloaded open transect view
		if ((e.rowData.color === 'black') && ( ! e.rowData.exported)) {
			var transects = Alloy.createController("transects", {siteGUID:e.rowData.siteGUID, parkName:e.rowData.site}).getView();
			$.navGroupWin.openWindow(transects);
		} else if (e.rowData.exported) {
			alert('Survey cannot be edited after uploading');
		// else do nothing
		} else {
			alert('must download first ------>');
		}
	}
});

Ti.App.addEventListener("app:dataBaseError", function(e) {
	Titanium.API.error("Database error: " + e.error);
});

Ti.App.addEventListener("app:fileSystemError", function(e) {
	Titanium.API.error("File system error: " + e.error);
});

Ti.App.addEventListener("app:refreshSiteSurveys", function(e) {
	checkSurveys();
});

//Download Indicator Events
Ti.App.addEventListener("app:downloadStarted", function(e){
	console.log('DownloadStarted - Event fired');
	//downloadIndicator.show();
	indicator.openIndicator();
});

Ti.App.addEventListener("app:downloadFailed", function(e){
	console.log('DownloadFailed - Event fired');
	//downloadIndicator.hide();
	indicator.closeIndicator();
	alert('Download Failed');
});

Ti.App.addEventListener("app:downloadFinished", function(e){
	console.log('DownloadFinished - Event fired');
	//downloadIndicator.hide();
	indicator.closeIndicator();
	alert('Download Complete');
});

//Upload Indicator Events
Ti.App.addEventListener("app:uploadStarted", function(e){
	console.log('UploadStarted - Event fired');
	//uploadIndicator.show();
	indicator.openIndicator();
});

Ti.App.addEventListener("app:uploadFailed", function(e){
	console.log('UploadFailed - Event fired');
	//uploadIndicator.hide();
	indicator.closeIndicator();
	alert('Upload Failed');
});

Ti.App.addEventListener("app:uploadFinished", function(e){
	console.log('UploadFinished - Event fired');
	
	try{
		var db = Ti.Database.open('ltemaDB');
		
		var sections = $.tbl.data;
		var currRowGUID = Ti.App.Properties.getString('current_row_guid');
		for(var i = 0; i < sections.length; i++) {
		    var section = sections[i];
		 
		    for(var j = 0; j < section.rowCount; j++) {
		        var row = section.rows[j];
		        var tableRowGUID = row.siteGUID;
		        
		        if (tableRowGUID === currRowGUID) {
		        	var d = new Date();
					var exported = d.getTime();
		        	db.execute('UPDATE site_survey SET exported = ? WHERE site_survey_guid = ?', exported, tableRowGUID);
		        	Ti.App.fireEvent("app:refreshSiteSurveys");
		    		break;
		    	}
		    }
		}
	} catch (e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		//uploadIndicator.hide();
		indicator.closeIndicator();
		alert('Upload Complete');
	}
});

Ti.App.addEventListener("app:enableIndexAddButton", function(e) {
	$.addSite.enabled = true;
});

Ti.App.addEventListener("app:enableIndexExportButton", function(e) {
	$.exportData.enabled = true;
});

Ti.App.addEventListener("app:enableIndexLoginButton", function(e) {
	
	$.login.enabled = true;
	if (! Ti.App.Properties.getString('secret') || ! Ti.App.Properties.getString('auth_level')) {
		$.login.title = "Login";
	} else {
		$.login.title = "Logout";
	}
});

Ti.App.addEventListener("app:enableIndexRefreshButton", function(e) {
	$.refreshBtn.enabled = true;
});

Ti.Network.addEventListener('change', function(e) {
	networkIsOnline = e.online;
	Ti.App.fireEvent("app:refreshSiteSurveys");
});


/* Functions */

//Enable or Disable the Edit and Add buttons based on row count
function toggleEditBtn(){
	//get the number of total rows
	var numRows = showTotalRowNumber();
	//if no rows exist
	if(numRows <= 0){
		//disable Edit  and Add buttons
		$.editSite.enabled = false;
		$.editSite.title = "Edit";
		$.addSite.enabled = true;
		$.tbl.editing = false;
		$.exportData.enabled = false;
	}else{
		//enable Edit and Add buttons
		$.editSite.enabled = true;
		if ($.tbl.editing == false) {
			$.exportData.enabled = true;
		}
	}
}

//Function to get total number of rows (site surveys)
function showTotalRowNumber(){
	// Variable to get all section
	var allSection = $.tbl.data;

	var sectionNumber = 0;
	var totalRows = 0;

	for(sectionNumber = 0; sectionNumber < allSection.length; sectionNumber++){
		// Get rows for each section
		totalRows += allSection[sectionNumber].rowCount;
	}
	return totalRows;
}

//Edit button toggle
function editBtn(e){

	//enable or disable edit mode
	if (e.source.title == "Edit") {
		$.tbl.editing = true;
		e.source.title = "Done";
		//disable the add and export buttons during edit mode
		$.addSite.enabled = false;
		$.exportData.enabled = false;

	} else {
		$.tbl.editing = false;
		e.source.title = "Edit";
		//enable the add and export button
		$.addSite.enabled = true;
		$.exportData.enabled = true;
		Ti.App.fireEvent("app:refreshSiteSurveys");
	}
}

function loginBtn() {
	// get user to input secret (authentication)
	var loggedIn = Ti.App.Properties.getString('secret') === null ? false : true;
	
	if ( ! loggedIn) {
		var dialog = Ti.UI.createAlertDialog({
			title: "Enter Secret",
			style: Ti.UI.iPhone.AlertDialogStyle.PLAIN_TEXT_INPUT,
			buttonNames: ['OK']
		});
			
		dialog.addEventListener('click', function(e){
			var secret = e.text;
			Ti.API.info('e.text: ' + secret);
			var regex = /^[01]{1}\w{4}-\w{5}-\w{5}-\w{5}-\w{5}$/;
			if (secret.match(regex)){
				authenticate(secret);
			} else {
				alert('bad secret format');
			}
		});
		dialog.show();
	// already logged in
	} else {
		var dialog = Ti.UI.createAlertDialog({
			cancel: 1,
			buttonNames: ['Confirm', 'Cancel'],
			message: 'Are you sure you want to logout?',
			title: 'Logout'
	  	});
		dialog.addEventListener('click', function(e){
			if (e.index === e.source.cancel){
				Ti.API.info('The cancel button was clicked');
			} else {
				Ti.API.info('device logged out');
				$.login.title = "Login";
				Ti.App.Properties.setString('auth_level',null);
				Ti.App.Properties.setString('secret',null);
				Ti.App.fireEvent("app:refreshSiteSurveys");
			}
		});
		dialog.show();
	}		
}

function authenticate(secret){
	// check for network
	if (Titanium.Network.networkType == Titanium.Network.NETWORK_NONE){
		var alertDialog = Titanium.UI.createAlertDialog({
			title: 'WARNING!',
			message: 'Your device is not online.',
			buttonNames: ['OK']
		});
		alertDialog.show();

	} else {
		try {
			var url = "https://capstone-ltemac.herokuapp.com/imageStorageKey";
			var httpClient = Ti.Network.createHTTPClient();
			httpClient.open("GET", url);
			httpClient.setRequestHeader('secret', secret);
			httpClient.setRequestHeader('Content-Type', 'application/json');

			httpClient.onload = function() {
				if (this.status === 200) {
					Ti.API.info("Received text (index L547): " + this.responseData);
					var returnArray = JSON.parse(this.responseData);
					checkAuthLevel(returnArray, secret);
					$.login.title = "Logout";
					alert('successful auth check');
				} else {
					alert('invalid status code response: ' + this.status);
				}
			};
			httpClient.onerror = function(e) {
				Ti.API.debug("STATUS: " + this.status);
				Ti.API.debug("TEXT:   " + this.responseText);
				Ti.API.debug("ERROR:  " + e.error);
				alert('error validating credentials, server offline');
			};
			httpClient.send();
		} catch (e) {
			var errorMessage = e.message;
			console.log('error in authentication function: ' + errorMessage);
		}
	}
}

// check with cloud and then set persistent variables
function checkAuthLevel(json, secret) {
	var authLevel = json.auth_level;
	var flickrAccessToken = json.access_token;
	var flickrAccessSecret = json.access_secret;
	var flickrConsumerKey = json.consumer_key;
	var flickrConsumerSecret = json.consumer_secret;
	
	if (authLevel == 1 || authLevel == 9){
		//set authLevel into Titanium variable, accessable by getString('auth_level')
		Ti.App.Properties.setString('auth_level',authLevel);
		Ti.App.Properties.setString('secret',secret);
		
		//refresh survey list
		Ti.App.fireEvent("app:refreshSiteSurveys");
	} else {
		console.log('authLevel not valid: ' + authLevel);
		return;
	}
	Ti.App.Properties.setString('access_token',flickrAccessToken);
	Ti.App.Properties.setString('access_secret',flickrAccessSecret);
	Ti.App.Properties.setString('consumer_key',flickrConsumerKey);
	Ti.App.Properties.setString('consumer_secret',flickrConsumerSecret);
}

//Navigate to site survey creation screen
function addBtn(){
	//disable add button until screen is returned to focus.  Issue #28
	$.addSite.enabled = false;

	var addSite = Alloy.createController("addSiteSurvey").getView();
	$.navGroupWin.openWindow(addSite);
}

//Export data
function exportBtn(){
	//button de-bounce - issue #28
	$.exportData.enabled = false;
	var modal = Alloy.createController("exportModal").getView();
	modal.open({
		modal : true,
		modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
		modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
		navBarHidden : false
	});
}

function refreshBtn() {
	Ti.App.fireEvent("app:refreshSiteSurveys");
}

//This should always happen last
Alloy.Globals.navMenu = $.navGroupWin;
$.navGroupWin.open();
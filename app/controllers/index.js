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

checkSurveys();

function checkSurveys() {
	console.log('enter checkSurveys');

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

			console.log('enter try');

			var url = "https://capstone-ltemac.herokuapp.com/getSurveys";
			console.log('create httpClient object');
			var httpClient = Ti.Network.createHTTPClient();

			console.log('httpClient object created');

			console.log('httpClient opening now');
			// the 'false' optional parameter makes this a synchronous call
			httpClient.open("GET", url);
			console.log('httpClient opened');

			httpClient.setRequestHeader('secret', '12345-12345-12345-12345-12345');
			httpClient.setRequestHeader('Content-Type', 'application/json');

			httpClient.onload = function() {
				//call checkLocalSurveys, pass in results
				Ti.API.info("Received text (index L39): " + this.responseData);
				var returnArray = JSON.parse(this.responseData).rows;
				checkLocalSurveys(returnArray);
				//alert('success');
			};
			httpClient.onerror = function(e) {
				Ti.API.debug("STATUS: " + this.status);
				Ti.API.debug("TEXT:   " + this.responseText);
				Ti.API.debug("ERROR:  " + e.error);
				var cloudSurveys = [];
				checkLocalSurveys(cloudSurveys);
				//alert('error retrieving remote data');
			};

			console.log('setRequestHeader secret, now sending');
			httpClient.send();
			console.log('httpClient object has been sent');
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
		var rows = db.execute('SELECT site_id, site_survey_guid, year, protocol_name, park_name \
						FROM site_survey s, protocol p, park prk \
						WHERE s.protocol_id = p.protocol_id \
						AND s.park_id = prk.park_id ');

		var localSurveys = [];
		while (rows.isValidRow()){
			var protocolName = rows.fieldByName('protocol_name');
			var parkName = rows.fieldByName('park_name');
			var siteID = rows.fieldByName('site_id');
			var siteGUID = rows.fieldByName('site_survey_guid');
			var year = rows.fieldByName('year');
			var results = {'site_id': siteID, 'site_survey_guid' : siteGUID, 'date_surveyed' : year, 'protocol' : protocolName, 'site' : parkName};
			localSurveys.push(results);

			rows.next();
		}
		console.log('index L100 localSurveys: ');
		console.log(localSurveys);

		populateTable(cloudSurveys, localSurveys);

	} catch(e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		toggleEditBtn();
	}
}

function createButtons(rows, downloadExists) {
	console.log('enter createButtons');
	console.log('createButtons line 52 rows value: ');
	//console.log(rows);
	console.log('downloadExists=' + downloadExists);
	
	//Get requested data from each row in table
	for (var i = 0; i < rows.length; i++) {
		var site = rows[i]['site'];
		var year = rows[i]['date_surveyed'];
		var protocol = rows[i]['protocol'];
		var versionNo = rows[i]['version_no'];
		var siteGUID = rows[i]['site_survey_guid'];

		//create a string from each entry
		var siteSurvey = year.slice(0,4) + ' - ' + protocol + ' - ' + site;
		console.log('createButtons siteSurvey: ' + siteSurvey);

		//create a new row (gray out if not downloaded)
		if (downloadExists) {
			var newRow = Ti.UI.createTableViewRow({
				title: siteSurvey,
				site: site,
				siteGUID: siteGUID,
				protocol: protocol, //not visible, but passed to transects screen
				height: 60,
				font: {fontSize: 20},
				color: 'black'
			});
		} else {
			var newRow = Ti.UI.createTableViewRow({
				title: siteSurvey,
				site: site,
				siteGUID: siteGUID,
				protocol: protocol, //not visible, but passed to transects screen
				height: 60,
				font: {fontSize: 20},
				color: 'gray'
			});
		}
		//create and add info icon for the row
		var infoButton = Ti.UI.createButton({
			style : Titanium.UI.iPhone.SystemButton.DISCLOSURE,
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
		var uploadButton = Ti.UI.createButton({
			backgroundImage:'icons/upload.png',
			backgroundFocusedImage: 'icons/upload_clicked.png',
			backgroundSelectedImage: 'icons/upload_clicked.png',
			right : 135,
			height: 60,
			width: 60,
			buttonid: 'upload'
		});
		var exportButton = Ti.UI.createButton({
			backgroundImage:'icons/export.png',
			backgroundFocusedImage: 'icons/export_clicked.png',
			backgroundSelectedImage: 'icons/export_clicked.png',
			right : 195,
			height: 60,
			width: 60,
			buttonid: 'export'
		});

		newRow.add(infoButton);
		newRow.add(downloadButton);
		newRow.add(uploadButton);
		newRow.add(exportButton);

		//Add row to the table view
		$.tbl.appendRow(newRow);
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
	for (var i = 0; i < cloudSurveys.length; i++) {
		var protocolNameOnCloud = cloudSurveys[i].protocol;
		var parkNameOnCloud = cloudSurveys[i].site;
		var yearOnCloud = cloudSurveys[i].date_surveyed;
		var cloudSiteGUID = cloudSurveys[i].site_survey_guid;

		var lengthDownloadedBefore = cloudAndLocalSurveys.length;
		for (var j = 0; j < localSurveys.length; j++) {
			var protocolNameOnDevice = localSurveys[j]['protocol'];
			var parkNameOnDevice = localSurveys[j]['site'];

			console.log('index L230 (pd, pc, prkD, prkC): ' + protocolNameOnDevice + ' ' + protocolNameOnCloud + ' ' + parkNameOnDevice + ' ' + parkNameOnCloud);
			// already downloaded
			if ((protocolNameOnCloud == protocolNameOnDevice) && (parkNameOnCloud == parkNameOnDevice)) {
				console.log('MATCHED! index L341 (pd, pc, prkD, prkC): ' + protocolNameOnDevice + ' ' + protocolNameOnCloud + ' ' + parkNameOnDevice + ' ' + parkNameOnCloud);
				var siteID = localSurveys[j]['site_id'];
				var siteGUID = localSurveys[j]['site_survey_guid'];
				var yearOnDevice = localSurveys[j]['date_surveyed'];
				var results = {'site_id':siteID, 'site_survey_guid': siteGUID, 'date_surveyed': yearOnDevice, 'protocol':protocolNameOnDevice, 'site':parkNameOnDevice};

				cloudAndLocalSurveys.push(results);
				break;
			}
		}
		//check if there were matches 
		var lengthDownloadedAfter = cloudAndLocalSurveys.length;
		if (lengthDownloadedAfter == lengthDownloadedBefore) {
			// didn't match cloud to device, add to cloudOnlySurveys
			var results = {'site_survey_guid': cloudSiteGUID, 'date_surveyed': yearOnCloud, 'protocol': protocolNameOnCloud, 'site': parkNameOnCloud};
			cloudOnlySurveys.push(results);
		}
	}

	//check for localOnly
	var localOnlySurveys = [];
	console.log('index L 254 local surveys length ' + localSurveys.length);
	for (var i = 0; i < localSurveys.length; i++) {
		var protocolNameOnDevice = localSurveys[i]['protocol'];
		var parkNameOnDevice = localSurveys[i]['site'];
		var yearOnDevice = localSurveys[i]['date_surveyed'];
		var siteGUID = localSurveys[i]['site_survey_guid'];

		var matched = false;
		for (var j = 0; j < cloudAndLocalSurveys.length; j++) {
			var parkNameOnCloud = cloudSurveys[j].site;
			var protocolNameOnCloud = cloudAndLocalSurveys[j].protocol;

			console.log('index L262 (pd, pc, prkD, prkC): ' + protocolNameOnDevice + ' ' + protocolNameOnCloud + ' ' + parkNameOnDevice + ' ' + parkNameOnCloud);
			
			// if there's a match, skip to next iteration of i
			if ((protocolNameOnCloud == protocolNameOnDevice) && (parkNameOnCloud == parkNameOnDevice)) {
				console.log('MATCHED! index L274 (pd, prkC): ' + protocolNameOnDevice + ' ' + parkNameOnCloud);
				matched = true;
				break;
			}
		}

		// if no match, add record to localOnly
		if (matched == false) {
			var results = {'site_survey_guid': siteGUID, 'date_surveyed': yearOnDevice, 'protocol': protocolNameOnDevice, 'site': parkNameOnDevice};
			localOnlySurveys.push(results);
		}
	}

	console.log ('cloudOnlySurveys line 401 index.js: ');
	console.log(cloudOnlySurveys.length);
	console.log ('cloudAndLocalSurveys line 404 index.js: ');
	console.log(cloudAndLocalSurveys);
	console.log ('localOnlySurveys line 404 index.js: ');
	console.log(localOnlySurveys);

	createButtons(localOnlySurveys, true);
	createButtons(cloudAndLocalSurveys, true);
	createButtons(cloudOnlySurveys, false);

	console.log('got through createButton functions line 411 index.js');

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


/* Event Listeners */

/*
// pull down to refresh
$.tbl.addEventListener('refreshstart', function(e) {
	Ti.API.info('refreshstart');

	section.appendItems(genData());
	control.endRefreshing();
});
*/

//Delete event listener
$.tbl.addEventListener('delete', function(e) {
	//get the site_id of the current row being deleted
	var currentSiteGUID = e.rowData.siteGUID;
	try{
		//open database
		var db = Ti.Database.open('ltemaDB');

		// Delete any saved files associated with this site survey
		var folder = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, e.rowData.title);
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

		var download = require('download');
		download.downloadSurvey(e.rowData.site, e.rowData.protocol);

		//upload button clicked
	} else if (e.source.buttonid == 'upload') {
		alert('Upload button pressed! Calling upload function...');

		var upload = require('upload');
		upload.uploadSurvey();

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
		if (e.rowData.color == 'black') {
			var transects = Alloy.createController("transects", {siteGUID:e.rowData.siteGUID, parkName:e.rowData.parkName}).getView();
			$.navGroupWin.openWindow(transects);
		
		// else do nothing
		} else {
			alert('must download first');
		}
	}
});

Ti.App.addEventListener("app:dataBaseError", function(e) {
	//TODO: handle a database error for the app
	Titanium.API.error("Database error: " + e.error);
});

Ti.App.addEventListener("app:fileSystemError", function(e) {
	//TODO: handle a file system error for the app
	Titanium.API.error("File system error: " + e.error);
});

Ti.App.addEventListener("app:refreshSiteSurveys", function(e) {
	checkSurveys();
});

Ti.App.addEventListener("app:enableIndexAddButton", function(e) {
	$.addSite.enabled = true;
});

Ti.App.addEventListener("app:enableIndexExportButton", function(e) {
	$.exportData.enabled = true;
});

Ti.App.addEventListener("app:enableIndexRefreshButton", function(e) {
	$.refreshBtn.enabled = true;
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
	}
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
	checkSurveys();
}

//This should always happen last
Alloy.Globals.navMenu = $.navGroupWin;
$.navGroupWin.open();
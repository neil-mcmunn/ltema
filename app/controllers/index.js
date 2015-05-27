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

var surveyList = [];
//var json;




populateTable();

function checkSurveys() {
	console.log('enter checkSurveys');

	try {

		console.log('enter try');

		var url = "https://capstone-ltemac.herokuapp.com/getSurveys";
		console.log('create httpClient object');
		var httpClient = Ti.Network.createHTTPClient();

		console.log('httpClient object created');

		console.log('httpClient opening now');
		// the 'false' optional parameter makes this a synchronous call
		httpClient.open("GET", url, false);
		console.log('httpClient opened');

		httpClient.setRequestHeader('secret', '12345-12345-12345-12345-12345');
		httpClient.setRequestHeader('Content-Type', 'application/json');

		httpClient.onload = function() {
			Ti.API.info("Received text (index L39): " + this.responseText);
			//json = eval('(' + this.responseText + ')');
			//json = this.responseText;
			//console.log('onload: ');
			//console.log(json);
			alert('success');
		};
		httpClient.onerror = function(e) {
			Ti.API.debug("STATUS: " + this.status);
			Ti.API.debug("TEXT:   " + this.responseText);
			Ti.API.debug("ERROR:  " + e.error);
			alert('error retrieving remote data');
		};

		console.log('setRequestHeader secret, now sending');
		httpClient.send();
		console.log('httpClient object has been sent');
	}
	catch (e) {
		var errorMessage = e.message;
		console.log('error in checkSurveys: ' + errorMessage);
	}
	finally {
		//httpClient.close();
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

		//create a string from each entry
		var siteSurvey = year.slice(0,4) + ' - ' + protocol + ' - ' + site;
		console.log('createButtons siteSurvey: ' + siteSurvey);

		//create a new row (gray out if not downloaded)
		if (downloadExists) {
			var newRow = Ti.UI.createTableViewRow({
				title: siteSurvey,
				site: site,
				protocol: protocol, //not visible, but passed to transects screen
				height: 60,
				font: {fontSize: 20},
				color: 'black'
			});
		} else {
			var newRow = Ti.UI.createTableViewRow({
				title: siteSurvey,
				site: site,
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
			height: 30,
			width: 30,
			buttonid: 'download'
		});
		var uploadButton = Ti.UI.createButton({
			backgroundImage:'icons/upload.png',
			backgroundFocusedImage: 'icons/upload_clicked.png',
			backgroundSelectedImage: 'icons/upload_clicked.png',
			right : 135,
			height: 30,
			width: 30,
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

function populateTable() {
	$.addSite.enabled = true;
	//Clear the table if there is anything in it
	var rd = []; 
	$.tbl.data = rd;
	
	var json = {
	"command": "SELECT",
	"rowCount": 11,
	"oid": null,
	"rows": [
		{
			"site": "testSite",
			"protocol": "testProtocol",
			"date_surveyed": "2015-05-01T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "uploadSiteTest1",
			"protocol": "intertidal",
			"date_surveyed": "2015-05-04T00:00:00.000Z",
			"version_no": 2
		},
		{
			"site": "uploadSiteTest1",
			"protocol": "intertidal1",
			"date_surveyed": "2015-05-04T00:00:00.000Z",
			"version_no": 2
		},
		{
			"site": "uploadSiteTest2",
			"protocol": "uploadProtocolTest1",
			"date_surveyed": "2015-05-04T00:00:00.000Z",
			"version_no": 2
		},
		{
			"site": "uploadSiteTest1",
			"protocol": "uploadProtocolTest1",
			"date_surveyed": "2015-05-04T00:00:00.000Z",
			"version_no": 2
		},
		{
			"site": "uploadSiteTest2",
			"protocol": "uploadProtocolTest2",
			"date_surveyed": "2015-05-04T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "MacMillan Park",
			"protocol": "Alpine",
			"date_surveyed": "2015-05-25T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "Macmillan Park",
			"protocol": "Alpine",
			"date_surveyed": "2015-05-25T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "Gerald Island Park",
			"protocol": "Alpine",
			"date_surveyed": "2015-05-25T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "Sand Point Conservancy",
			"protocol": "Alpine",
			"date_surveyed": "2015-05-25T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "Victor Lake Park",
			"protocol": "Grassland",
			"date_surveyed": "2015-05-25T00:00:00.000Z",
			"version_no": 1
		},
		{
			"site": "Ilgachuz Range Ecological Reserve",
			"protocol": "Alpine",
			"date_surveyed": "2015-05-25T00:00:00.000Z",
			"version_no": 1
		}
	],
	"fields": [
		{
			"name": "site",
			"tableID": 524614,
			"columnID": 1,
			"dataTypeID": 1043,
			"dataTypeSize": -1,
			"dataTypeModifier": 104,
			"format": "text"
		},
		{
			"name": "protocol",
			"tableID": 524614,
			"columnID": 2,
			"dataTypeID": 1043,
			"dataTypeSize": -1,
			"dataTypeModifier": 104,
			"format": "text"
		},
		{
			"name": "date_surveyed",
			"tableID": 524614,
			"columnID": 4,
			"dataTypeID": 1082,
			"dataTypeSize": 4,
			"dataTypeModifier": -1,
			"format": "text"
		},
		{
			"name": "version_no",
			"tableID": 524614,
			"columnID": 6,
			"dataTypeID": 23,
			"dataTypeSize": 4,
			"dataTypeModifier": -1,
			"format": "text"
		}
	],
	"_parsers": [
		null,
		null,
		null,
		null
	],
	"rowAsArray": false
};

	try {
		//open database
		var db = Ti.Database.open('ltemaDB');

		console.log('before checkSurveys index line 158');
		// get list of all surveys on cloud
		checkSurveys();
		//console.log('after checkSurveys index line 161, now printing cloudRows');
		//console.log('json line 162 index.js: \n' + json.rows);
		var cloudRows = json.rows;
		console.log('cloudRows: \n\n');
		console.log(cloudRows);
		console.log('end cloudRows. \n\n');

		//Query - Retrieve existing sites from sqlite database
		var rows = db.execute('SELECT site_id, site_survey_guid, year, protocol_name, park_name \
						FROM site_survey s, protocol p, park prk \
						WHERE s.protocol_id = p.protocol_id \
						AND s.park_id = prk.park_id ');

		var surveysFromSQLITE = [];
		while (rows.isValidRow()){
			var protocolName = rows.fieldByName('protocol_name');
			var parkName = rows.fieldByName('park_name');
			var siteID = rows.fieldByName('site_id');
			var siteGUID = rows.fieldByName('site_survey_guid');
			var year = rows.fieldByName('year');
			var results = {'site_id': siteID, 'site_survey_guid' : siteGUID, 'date_surveyed' : year, 'protocol' : protocolName, 'site' : parkName};
			surveysFromSQLITE.push(results);

			rows.next();
		}
		console.log('index L316 surveysFromSQLITE: ');
		console.log(surveysFromSQLITE);

		// check for network
		if(Titanium.Network.networkType == Titanium.Network.NETWORK_NONE){
		 var alertDialog = Titanium.UI.createAlertDialog({
			  title: 'WARNING!',
			  message: 'Your device is not online.',
			  buttonNames: ['OK']
			});
			alertDialog.show();
			
			if (surveysFromSQLITE.length > 0) {
				createButtons(surveysFromSQLITE, true);
			}
		} else {
			// separate downloaded and available surveys
			var downloadedSurveys = [];
			var availableSurveys = [];
			console.log('cloudRows length: ' + cloudRows.length);
	
			for (var i = 0; i < cloudRows.length; i++) {
				var protocolNameOnCloud = cloudRows[i].protocol;
				var parkNameOnCloud = cloudRows[i].site;
				var yearOnCloud = cloudRows[i].date_surveyed;
				
				var lengthDownloadedBefore = downloadedSurveys.length;
				for (var j = 0; j < surveysFromSQLITE.length; j++) {
					var protocolNameOnDevice = surveysFromSQLITE[j]['protocol'];
					var parkNameOnDevice = surveysFromSQLITE[j]['site'];
	
					console.log('index L338 (pd, pc, prkD, prkC): ' + protocolNameOnDevice + ' ' + protocolNameOnCloud + ' ' + parkNameOnDevice + ' ' + parkNameOnCloud);
					// already downloaded
					if ((protocolNameOnCloud == protocolNameOnDevice) && (parkNameOnCloud == parkNameOnDevice)) {
						console.log('MATCHED! index L341 (pd, pc, prkD, prkC): ' + protocolNameOnDevice + ' ' + protocolNameOnCloud + ' ' + parkNameOnDevice + ' ' + parkNameOnCloud);
						var siteID = surveysFromSQLITE[j]['site_id'];
						var siteGUID = surveysFromSQLITE[j]['site_survey_guid'];
						var yearOnDevice = surveysFromSQLITE[j]['date_surveyed'];
						var results = {'site_id':siteID, 'site_survey_guid': siteGUID, 'date_surveyed': yearOnDevice, 'protocol':protocolNameOnDevice, 'site':parkNameOnDevice};
						downloadedSurveys.push(results);
						
						// remove this row from rows array
						//cloudRows.splice(i, 1);
						continue;
					}
				}
				//check if there were matches 
				var lengthDownloadedAfter = downloadedSurveys.length;
				if (lengthDownloadedAfter == lengthDownloadedBefore) {
					// didn't match cloud to device, add to availableSurveys
					var results = {'date_surveyed': yearOnCloud, 'protocol':protocolNameOnCloud, 'site':parkNameOnCloud};
					availableSurveys.push(results);
				}
			}
	
			console.log ('downloadedSurveys line 318 index.js: ');
			console.log(downloadedSurveys);
			//var availableSurveys = cloudRows;
			console.log ('availableSurveys line 320 index.js: ');
			console.log(availableSurveys);
	
			createButtons(downloadedSurveys, true);
			createButtons(availableSurveys, false);
	
			console.log('got through createButton functions line 325 index.js');
		}
		
	} catch(e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		db.close();
		toggleEditBtn();
	}
}

function download() {

}

function upload() {

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

//Delete event listener
$.tbl.addEventListener('delete', function(e) { 
	//get the site_id of the current row being deleted
	var currentSiteID = e.rowData.siteID;
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
		db.execute('DELETE FROM site_survey WHERE site_id = ?', currentSiteID);
		
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
		var modal = Alloy.createController("siteSurveyModal", {siteID:e.rowData.siteID}).getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});
	//download button clicked
	} else if (e.source.buttonid == 'download') {
		var modal = Alloy.createController("siteSurveyModal", {siteID:e.rowData.siteID}).getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});
	//upload button clicked
	} else if (e.source.buttonid == 'upload') {
		var modal = Alloy.createController("siteSurveyModal", {siteID:e.rowData.siteID}).getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});
	//row clicked, get transect view
	} else {
		var transects = Alloy.createController("transects", {siteID:e.rowData.siteID, parkName:e.rowData.parkName}).getView();
		$.navGroupWin.openWindow(transects);
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
	populateTable();
});

Ti.App.addEventListener("app:enableIndexAddButton", function(e) {
	$.addSite.enabled = true;
});

Ti.App.addEventListener("app:enableIndexExportButton", function(e) {
	$.exportData.enabled = true;
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

//This should always happen last
Alloy.Globals.navMenu = $.navGroupWin;
$.navGroupWin.open();
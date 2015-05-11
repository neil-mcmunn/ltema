/*
 *  List screen to view, add, or delete quadrats
 * 
 * expected args: transectID, siteID 
 */

var args = arguments[0];
var transectID = args.transectID;
$.tbl.transectID = transectID;
var siteID = args.siteID;

populateTable();
toggleAddBtn();

/* Nav Bar Label */

// Build title label
var parkName = "";
var transectName ="";

try {
	var db = Ti.Database.open('ltemaDB');
	
	var resultRow = db.execute (	'SELECT p.park_name, t.transect_name \
								FROM park p, transect t, site_survey s \
								WHERE s.site_id = t.site_id \
								AND p.park_id = s.park_id \
								AND t.transect_id = ?' , transectID);
	parkName = resultRow.fieldByName('park_name');
	transectName = resultRow.fieldByName('transect_name');
} catch (e) {
	var errorMessage = e.message;
	Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
} finally {
	resultRow.close();
	db.close();
}

var labelText = parkName + ' - ' + transectName;

var titleLabel = Titanium.UI.createLabel({
	top:10,
	text: labelText,
	textAlign:'center',
	font:{fontSize:20,fontWeight:'bold'}
});

// Associate label to title
$.quadratsWin.setTitleControl(titleLabel);


/* Event Listeners */

Ti.App.addEventListener("app:refreshQuadrats", function(e) {
	populateTable();
	toggleAddBtn();
});

// Table row click event
$.tbl.addEventListener('click', function(e){
	//ignore row clicks in edit mode
	if ($.tbl.editing == true) {
		return;
	}
	
	//check if media exists -if no photo has been taken (re-visited quadrat)
	if(e.rowData.mediaID == null){
		var modal = Alloy.createController("quadratsModal", {quadratID:e.rowData.quadratID, title:e.rowData.title, siteID:siteID, quadratName:e.rowData.quadratName}).getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});
	}else{
	
	//info button clicked, display modal
	if(e.source.toString() == '[object TiUIButton]') {
		var modal = Alloy.createController("quadratsModal", {quadratID:e.rowData.quadratID, title:e.rowData.title, siteID:siteID, quadratName:e.rowData.quadratName}).getView();
		modal.open({
			modal : true,
			modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
			modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
			navBarHidden : false
		});
	//row clicked, get transect view
	}else{  
		//open quadrat observations
		var observations = Alloy.createController("quadratObservations", {quadratID:e.rowData.quadratID, siteID:siteID}).getView();
		var nav = Alloy.Globals.navMenu;
		nav.openWindow(observations);   
	}
  }
});

//Delete - event listener
$.tbl.addEventListener('delete', function(e) { 
	//get the quadrat_id of the current row to be deleted
	var currentQuadratID = e.rowData.quadratID;
	try{
		//open database
		var db = Ti.Database.open('ltemaDB');

		//GET FOLDER NAME - Retrieve site survery, year, park
		var rows = db.execute('SELECT year, protocol_name, park_name \
							FROM site_survey s, protocol p, park prk \
							WHERE s.protocol_id = p.protocol_id \
							AND s.park_id = prk.park_id \
							AND site_id = ?', siteID);
							
		//Name the directory	
		var year = rows.fieldByName('year');
		var protocolName = rows.fieldByName('protocol_name');
		var parkName = rows.fieldByName('park_name');
		
		var folder = year + ' - ' + protocolName + ' - ' + parkName;
		
		//delete associated media files
		var quadratFiles = db.execute('SELECT media_name \
												FROM media m, quadrat p \
												WHERE m.media_id = p.media_id \
												AND p.quadrat_id = ? ', currentQuadratID);
		
		var fileName = quadratFiles.fieldByName('media_name');
		deleteImage(fileName, folder);
		
		var quadratObservationFiles = db.execute('SELECT media_name \
												FROM media m, quadrat_observation po \
												WHERE m.media_id = po.media_id \
												AND po.quadrat_id = ? ', currentQuadratID);
		
		while (quadratObservationFiles.isValidRow()) {
			var fileName = quadratObservationFiles.fieldByName('media_name');
			deleteImage(fileName, folder);
			quadratObservationFiles.next();
		}
		
		//delete current row from the database
		db.execute('DELETE FROM quadrat WHERE quadrat_id = ?', currentQuadratID);
		
		// Make the last row editable
		if ($.tbl.data[0]) {
			var lastRow = $.tbl.data[0].rowCount - 1;
			$.tbl.data[0].rows[lastRow].editable = true;
		}
		
		
		// Cycle toggle on the table to show the next row can be deleted
		$.tbl.editing = false;
		$.tbl.editing = true;
		
	} catch(e) {
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		rows.close();
		quadratFiles.close();
		quadratObservationFiles.close();
		db.close();
		toggleEditBtn();
	}
});


/* Functions */

function populateTable() {
	
	//Clear the table if there is anything in it
	var rd = []; 
	$.tbl.data = rd;
	try {
		//open database
		var db = Ti.Database.open('ltemaDB');
		
		//Query - Retrieve existing quadrats from database
		var rows = db.execute('SELECT quadrat_id, quadrat_name, utm_zone, utm_easting, utm_northing, media_id \
							FROM quadrat \
							WHERE transect_id = ?', $.tbl.transectID);
		
		//Get requested data from each row in table
		while (rows.isValidRow()) {	
			var quadratID = rows.fieldByName('quadrat_id');
			var quadratName = rows.fieldByName('quadrat_name');
			var utmZone = rows.fieldByName('utm_zone');
			var utmEasting = rows.fieldByName('utm_easting');
			var utmNorthing = rows.fieldByName('utm_northing');
			var mediaID = rows.fieldByName('media_id');
			
			var groundCoverRows = db.execute('SELECT sum(ground_cover) \
											FROM quadrat_observation \
											WHERE quadrat_id = ?', quadratID);
							
			var totalGroundCover = groundCoverRows.fieldByName('sum(ground_cover)');
			
			if (totalGroundCover == null) {
				totalGroundCover = 0;
			}
			
			//create the title for each quadrat row - name and utm info
			var quadratDesc = quadratName + ' - UTM Z:' + 
					utmZone + ' E:' + utmEasting + ' N:' + utmNorthing; 
			
			//create a new row
				var newRow = Ti.UI.createTableViewRow({
					title : quadratDesc,
					quadratName : quadratName,
					quadratID : quadratID,
					mediaID : mediaID,
					height: 60,
					font: {fontSize: 20},
					totalGroundCover: totalGroundCover,
					editable: false
				});
				
			//add the total ground cover label
				var groundCoverLabel = Ti.UI.createLabel({
					text: totalGroundCover + '%',
					right: 55,
					font: {fontSize: 20}
				});
				newRow.add(groundCoverLabel);
				
				//Select icon to be displayed (info or edit)
				if(mediaID != null){
					//create and add info icon for the row
					var infoButton = Ti.UI.createButton({
						style : Titanium.UI.iPhone.SystemButton.DISCLOSURE,
						right : 15,
						height: 60,
						width: 60
					});
				}else{
					//create and add info icon for the row
					var infoButton = Ti.UI.createButton({
						image : "icons/edit_file.png",
						right : 15,
						height: 30,
						width: 30
					});
				}
				newRow.add(infoButton);
				
				/*
				//change label colour if total ground cover is less than 100%
				if (totalGroundCover < 100) {
					 newRow.color = "red";
				}
				*/
				//Add row to the table view
				$.tbl.appendRow(newRow);
			
			rows.next();
		}
		
		// Make the last row editable
		if ($.tbl.data[0]) {
			var lastRow = $.tbl.data[0].rowCount - 1;
			$.tbl.data[0].rows[lastRow].editable = true;
		}
		
	} catch(e){
		var errorMessage = e.message;
		Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
	} finally {
		rows.close();
		db.close();
		toggleEditBtn();
	}
}

//EDIT BUTTON - toggle edit mode
function editBtn(e){
	//enable or disable edit mode
	if (e.source.title == "Edit") {
		$.tbl.editing = true;
		e.source.title = "Done";
		//disable the add button during edit mode
		$.addQuadrat.enabled = false;
		
	} else { 
		$.tbl.editing = false;
		e.source.title = "Edit";
		toggleAddBtn();
	}
}

//ADD BUTTON - add a new quadrat
function addBtn(){
	//disable add button until screen is returned to focus.  Issue #28
	$.addQuadrat.enabled = false;
		
	//Navigation to addQuadrat
	var addQuadrat = Alloy.createController("addQuadrat", {transectID: $.tbl.transectID}).getView();
	var nav = Alloy.Globals.navMenu;
	nav.openWindow(addQuadrat);
}		

//ADD BUTTON TOGGLE
function toggleAddBtn(){
	var incompleteQuadratCount = 0;
	var exceedTotalCoverageMax = false;
	//check if any rows exists
	if(showTotalRowNumber() > 0){
		//loop via quadrat list and check total ground cover
		for(var i=0; i < $.tbl.data[0].rows.length; i++) {
	        if($.tbl.data[0].rows[i].totalGroundCover < 100){
	        	//disable add quadrat button
	        	incompleteQuadratCount += 1;	
				//$.tbl.data[0].rows[i].color = "red";
			//check if the total coverage exceeds 400%
	        }else if($.tbl.data[0].rows[i].totalGroundCover > 400){
	        	//disable add quadrat button
	        	exceedTotalCoverageMax = true;
	        }
	    }
	 }  
	 //Check the number of incomplete Quadrat Count 
	    if(incompleteQuadratCount > 0){
	    	//disable add quadrat button
	    	$.addQuadrat.enabled = false;
			$.addQuadratError.visible = true;
		}else if(exceedTotalCoverageMax == true){
			$.addQuadrat.enabled = false;
			$.addQuadratError.text = "*Total Ground Coverage exceeds 400%";
			$.addQuadratError.visible = true;
	    }else{
	    	//enable add quadrat button
	        $.addQuadrat.enabled = true;
			$.addQuadratError.visible = false;
	    }
	
}

//Enable or Disable the Edit button
function toggleEditBtn(){
	//get the number of total rows
	var numRows = showTotalRowNumber();
	//if no rows exist
	if(numRows <= 0){
		//disable Edit Button
		$.editQuadrat.enabled = false;
		$.editQuadrat.title = "Edit";
		$.addQuadrat.enabled = true;
		$.tbl.editing = false;
		$.addQuadratError.visible = false;
	}else{
		//enable Edit Button
		$.editQuadrat.enabled = true;
	}
}

//Function to get total number of rows (quadrats)
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

// Delete a file from the application data directory
function deleteImage(fileName, folderName) {
	var imageDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, folderName);
	
	if (imageDir.exists()) {		
		// .resolve() provides the resolved native path for the directory.
		var imageFile = Ti.Filesystem.getFile(imageDir.resolve(), fileName);
		if (imageFile.exists()) {
			imageFile.deleteFile();
		}
	}
}
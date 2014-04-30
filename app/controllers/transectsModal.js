/* A screen to view and edit transect details */

// Get transectID from calling window
var args = arguments[0];
var transectID = args.transectID;

// Query the database and store values associated with a transectID
try {
	var db = Ti.Database.open('ltemaDB');
	
	resultRow = db.execute(	'SELECT transect_id, transect_name, surveyor, plot_distance, stake_orientation, comments \
							FROM transect t \
							WHERE transect_id = ?', transectID);					
	
	var transectName = resultRow.fieldByName('transect_name');
	var surveyor = resultRow.fieldByName('surveyor');
	var plotDistance = resultRow.fieldByName('plot_distance');
	var stakeOrientation = resultRow.fieldByName('stake_orientation');
	var comments = resultRow.fieldByName('comments'); 
	
	var initialTransectName = transectName;
	var initialSurveyor = surveyor;
	var initialPlotDistance = plotDistance;
	
	//Assign editable TextField values
	$.transectName.value = transectName;
	$.surveyor.value = surveyor;
	$.plotDistance.value = plotDistance;
	$.comments.value = comments;
	
	//TODO: perhaps an ENUM or CONSTANT would be useful here
	if (stakeOrientation === "Top Left / Bottom Right") {
		$.stakeBar.index = 0;
	} else if (stakeOrientation === "Top Right / Bottom Left") {
		$.stakeBar.index = 1;
	} else {
		alert('invalid stakeOrientation value');
	}
} catch (e) {
	alert ('DEV ALERT - transectsModal try/catch failed');
} finally {
	resultRow.close();
	db.close();
}

// Initially disable input fields
$.transectName.editable = false;
$.surveyor.editable = false;
$.plotDistance.editable = false;
$.comments.editable = false;


/* Listeners */

// Replace bad input (non-numbers) on plotDistance TextField
$.plotDistance.addEventListener('change', function(e) {
	e.source.value = e.source.value.replace(/[^0-9]+/,"");
});

// TESTING - an example of restricting the keyboard input
//Listen and replace bad input on transectName
//$.transectName.addEventListener('change', function (e) {
//	e.source.value = e.source.value.replace(/[^0-9a-zA-Z ()_,.-]/,"");
//});


/* Functions */

//swaps editable property of fields
function editBtnClick(e){
	//enable or disable edit mode
    if (e.source.title == "Edit") {
    	$.modalWin.editing = true;
        e.source.title = "Done";
        
        //Enable editing
        $.transectName.editable = true;
		$.surveyor.editable = true;
		$.plotDistance.editable = true;
		$.stakeBar.labels[0].enabled = true;
		$.stakeBar.labels[1].enabled = true;
		$.comments.editable = true;
        
        //disable the button button during edit mode
        $.backBtn.enabled = false;
        
    } else { 
        $.modalWin.editing = false;
        e.source.title = "Edit";
        //enable the back button
        $.backBtn.enabled = true;
        
        //disable editing
        $.transectName.editable = false;
		$.surveyor.editable = false;
		$.plotDistance.editable = false;
		$.stakeBar.labels[0].enabled = false;
		$.stakeBar.labels[1].enabled = false;
		$.comments.editable = false;
		saveEdit();
    }
}

//Save changes to transect
function saveEdit(){
	//validate input
	//TODO: Confirm all conditions with project specs, project sponsor
	var didError = false;
	if ($.transectName.value.length < 2) {
		alert('Transect Name should be at least 2 letters');
		didError = true;
	}
	if ($.surveyor.value.length < 2) {
		alert('Head surveyor name should be at least 2 letters');
		didError = true;
	}
	if ($.plotDistance.value < 1) {
		alert('Minimum plot distance is 1 meter');
		didError = true;
	}
	if ($.plotDistance.value > 99) {
		alert('Maximum plot distance is 99 meters');
		didError = true;
	}
	
	if (didError) {
		//if a test failed, reset all values
		$.transectName.value = initialTransectName;
		$.surveyor.value = initialSurveyor;
		$.plotDistance.value = initialPlotDistance;
		$.plotDistance.value = initialPlotDistance;
		return;
	}
	
	//input is valid, store it
	var db = Ti.Database.open('ltemaDB');
	db.execute( 'UPDATE OR FAIL transect SET transect_name= ?, surveyor= ?, plot_distance= ?, comments= ? WHERE transect_id= ?',
				$.transectName.value, $.surveyor.value, $.plotDistance.value, $.comments.value, transectID);
	db.close();
	
	//refresh successfully stored values to cope with multiple edits
	initialTransectName = $.transectName.value;
	initialSurveyor = $.surveyor.value;
	initialPlotDistance = $.plotDistance.value;
}

//Navigate back
function backBtnClick(){
	Ti.App.fireEvent("app:refreshTransects");
	$.modalNav.close();
}
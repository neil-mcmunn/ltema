//Place holder for edit button
function editBtn(){
	alert('You Clicked the Edit Button');
}

//Place holder for add button
function addBtn(){
	//Navigation to addPlot
	var addPlot = Alloy.createController("addPlot").getView();
	var nav = Alloy.Globals.navMenu;
	nav.openWindow(addPlot);
}

//Will be replaced once controller implemented
$.row1.addEventListener('click', function(e){
    var observations = Alloy.createController("plotObservations", {plotID:1}).getView(); //hardcoded for testing, replace with {plotID:e.rowData.plotID} when wired
    var nav = Alloy.Globals.navMenu;
    nav.openWindow(observations);
}); 

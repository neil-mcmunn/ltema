/* Preview the transect photo just taken */

var mediaName = Ti.App.Properties.getString('media_name');
var folderName = Ti.App.Properties.getString('folder_name');

// var temp=Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
var imageDir = Ti.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, folderName);
//alert(temp.resolve().toString());
var imageFile = Ti.Filesystem.getFile(imageDir.resolve(), mediaName);

var back=Titanium.UI.createImageView({
   //check if asect ratio
   //image:temp,
   image:imageFile,
   height:Ti.UI.FILL,
   width:Ti.UI.FILL
});
$.modalWin.add(back);


function backBtn(){
	$.modalNav.close();
}

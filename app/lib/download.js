// download a survey
// must specify the site and protocol

function processDownload(surveyData) {
    //do stuff with surveyData
    console.log('THE DOWNLOAD');
    console.log(surveyData);
}

function downloadSurvey(site, protocol) {
    try {
        console.log('enter try in downloadSurvey');

        var url = "https://capstone-ltemac.herokuapp.com/download?park=" + site + "&protocol=" + protocol;
        var httpClient = Ti.Network.createHTTPClient();

        httpClient.open("GET", url);

        httpClient.setRequestHeader('secret', '12345-12345-12345-12345-12345');
        httpClient.setRequestHeader('Content-Type', 'application/json');

        httpClient.onload = function() {
            //call checkLocalSurveys, pass in results
            Ti.API.info("Downloaded text: " + this.responseData);
            var returnArray = JSON.parse(this.responseData).survey_data;
            processDownload(returnArray);
            alert('successful download');
        };
        httpClient.onerror = function(e) {
            Ti.API.debug("STATUS: " + this.status);
            Ti.API.debug("TEXT:   " + this.responseText);
            Ti.API.debug("ERROR:  " + e.error);
            var cloudSurveys = [];
            processDownload(cloudSurveys);
            alert('error retrieving remote data');
        };

        httpClient.send();

        console.log('leaving try downloadSurvey gracefully');
    }
    catch (e) {
        var errorMessage = e.message;
        console.log('error in checkSurveys: ' + errorMessage);
    }
}

exports.downloadSurvey = downloadSurvey;
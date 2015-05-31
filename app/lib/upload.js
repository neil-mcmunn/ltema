// upload a survey
//

function uploadSurvey (site, protocol){
	//Create arrays to hold objects relevant to this survey
	var surveyJSON;
	
	//Form data for the given protocol
	switch(protocol){
		case alpine:
		case grassland:
			surveyJSON = formAlpineGrasslandJSON;
			break;
	  /*case intertidal:
			surveyJSON = formIntertidalJSON();
			break;*/
		default:
			console.log('ERROR: Given protocol does not support upload.');
			break;
	}
	
	//POST data to cloud
}

exports.uploadSurvey = uploadSurvey;

//Create a JSON object representing an alpine or grassland survey
//and then serialize it
function formAlpineGrasslandJSON(site){
	
	
	return undefined;
}

/*
//Create a JSON object representing an intertidal survey
//and then serialize it
function formIntertidalJSON(){
	
}
*/
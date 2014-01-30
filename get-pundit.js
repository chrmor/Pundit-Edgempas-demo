
	
    var annotationServerApi = "http://as.thepund.it:8080/annotationserver/api/";
	var decodedSearch = decodeURI(window.location.search);
	var sources = decodedSearch.split("source={")[decodedSearch.split("source={").length -1].split("}")[0].split(",");
	var notebookIds = decodedSearch.split("nbs={")[decodedSearch.split("nbs={").length -1].split("}")[0].split(",");

	var nbs, source;

	if (nbs === "undefined") {
		nbs='c4a2729c';
	}
	if (source === "undefined") {
		source='pundit';
	}

	var numberOfAnnotationsInCurrentNotebook = 0;
	var annotationsReadFromNotebook = 0;

	if (sources.indexOf("freebase") == -1) {

		// clear all the relations between philosophers...
		for(p in phils.ph) {
			phils.ph[p].to = {};
			phils.ph[p].fr = {};
			phils.ph[p].to_count = 0;
			phils.ph[p].fr_count = 0;
		}
        
	    phils.fr_max = 0;
        phils.to_max = 0;

	}

	if (sources.indexOf("pundit") !== -1) {

		//get annotations from notebooks
		for (i in notebookIds) {
			getNotebookAnnotations(notebookIds[i]);
		}	

	}

function addNotebook(id) {
	var newSearch = window.location.search.replace("nbs={","nbs={" + id + ",");
	var newLocation = location.origin + location.pathname + newSearch + location.hash;  
	location.href = newLocation;
}
 

function showFromFreebaseAndPundit() {
	var pieces = decodeURI(window.location.search).split("source=");
	pieces[1] = "source={freebase,pundit}";
	var newLocation = location.origin + location.pathname + pieces.join("") + location.hash;  
	location.href = newLocation;
}

function showFromPunditOnly() {
	var pieces = decodeURI(window.location.search).split("source=");
	pieces[1] = "source={pundit}";
	var newLocation = location.origin + location.pathname + pieces.join("") + location.hash;  
	location.href = newLocation;
}


function handleNotebookAnnotationsMetadata(annotations) {
	var cont = 0;
	for (ann in annotations) {
		cont ++;
	}
	numberOfAnnotationsInCurrentNotebook = cont;
	for (url in annotations) {
		getAnnotationGraph(annotations[url], annotations[url]["http://purl.org/pundit/ont/ao#id"][0].value);
	}
}

function handleAnnotationMetadataAndGraphAndItems(metadata, graph, items) {
	var annotator = metadata["http://purl.org/dc/elements/1.1/creator"][0].value;
	var annotationId = metadata["http://purl.org/pundit/ont/ao#id"][0].value;
	var annotatedPage = "";
	var annotatedTargetPage = "";
	var citedId = "";
	var citingId = "";
	var citedSentence = "";
	var citingSentence = "";
	var predicate = ""
	// for all the subjects of triples in the annotation graph ...
    for(subj in graph) {
        var screator;
        // scan all the predicates used in combination with  the given subject to find the dcterms:creator, which is the author of the annotated sentence
        for (pred in graph[subj]) {
            if (pred == "http://purl.org/dc/terms/creator") {
                screator = graph[subj]["http://purl.org/dc/terms/creator"][0].value;           
            }
        }
        
        if (typeof(screator) === 'undefined') {
            continue;
        }
        
		for (pred in graph[subj]) {

			if (pred.indexOf("http://purl.org/spar/cito/") !== -1) {

				predicate = items[pred]["http://www.w3.org/2000/01/rdf-schema#label"][0].value;				
                // if the subject of the triple is a sentence (a text-fragment)...
				if (items[subj]["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"][0].value == "http://purl.org/pundit/ont/ao#text-fragment" 
                     || items[subj]["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"][0].value == "http://purl.org/pundit/ont/ao#fragment-text") {
                    // get the ID of the author of the sentence...
					citingId = "/" + screator.split("/")[screator.split("/").length - 1].replace(".","/");
                    // get the text of the sentence ...
					citingSentence = items[subj]["http://purl.org/dc/elements/1.1/description"][0].value;
                    // get the page that was annotated ...
					annotatedPage = items[subj]["http://purl.org/pundit/ont/ao#hasPageContext"][0].value;
				}
				
                // Get the object of the triple ...
				obj = graph[subj][pred][0].value;
				
                // if the object is a sentence...
				if (items[obj]["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"][0].value == "http://purl.org/pundit/ont/ao#text-fragment"
                    || items[obj]["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"][0].value == "http://purl.org/pundit/ont/ao#fragment-text") {
                    // get the text of the sentence ...    
					citedSentence = items[obj]["http://purl.org/dc/elements/1.1/description"][0].value;	
                    // get the page where the sentence belongs to ...
					annotatedTargetPage = items[obj]["http://purl.org/pundit/ont/ao#hasPageContext"][0].value;
                    // get the author of the sentence ...
                    var ocreators = graph[obj]["http://purl.org/dc/terms/creator"];
                    // if the author is not specified, doscard the annotation ...
                    if (typeof(ocreators) === 'undefined') {
                        continue;
                    }
					citedUrl = ocreators[0].value;
                    // get the id of the author
					citedId = "/" + citedUrl.split("/")[citedUrl.split("/").length - 1].replace(".","/");
                // if the object is not a sentence, it should be a philosopher ...    
				} else {
					citedUrl = obj;
					citedId = "/" + citedUrl.split("/")[citedUrl.split("/").length - 1].replace(".","/");
				}
				
			}
			
		}
	}
	self.updateEdgemapsData(annotationId, annotator, annotatedPage, annotatedTargetPage, citedId, citingId, citedSentence, citingSentence, predicate);
	annotationsReadFromNotebook ++;
	if (annotationsReadFromNotebook == numberOfAnnotationsInCurrentNotebook) {
		init();
		annotationsReadFromNotebook = 0;
	}
	
}

function updateEdgemapsData(annotationId, annotator, annotatedPage, annotatedTargetPage, citedId, citingId, citedSentence, citingSentence, predicate) {

	//Annotations are taken into consideration only if cited and citing philosophers are already present in the JSON data
	if (phils.ph[citedId] == undefined || phils.ph[citingId] == undefined) {
		return;
	}
	
	if (phils.ph[citedId].to[citingId] == undefined) {
		phils.ph[citedId].to[citingId] = 1;
		phils.ph[citedId].to_count ++;
        phils.to_max ++;
	}
	if (phils.ph[citingId].fr[citedId] == undefined) {
		phils.ph[citingId].fr[citedId] = 1;
		phils.ph[citingId].fr_count ++;
        phils.fr_max ++;
	}
	if (phils.ph[citedId].annotations == undefined) {
		phils.ph[citedId].annotations = {};
	}
	if (phils.ph[citedId].annotations[citingId] == undefined) {
		phils.ph[citedId].annotations[citingId] = {};
	}
	phils.ph[citedId].annotations[citingId][annotationId] = {};
	phils.ph[citedId].annotations[citingId][annotationId].annotator = annotator;
	phils.ph[citedId].annotations[citingId][annotationId].annotated_sentence = citingSentence;
	phils.ph[citedId].annotations[citingId][annotationId].page = annotatedPage;
	phils.ph[citedId].annotations[citingId][annotationId].rel = predicate;
	
	if (annotatedTargetPage !== undefined && annotatedTargetPage !== "") {
		phils.ph[citedId].annotations[citingId][annotationId].target_page = annotatedTargetPage;
		phils.ph[citedId].annotations[citingId][annotationId].annotated_target_sentence = citedSentence;		
	}

	
};

function handleAnnotationGraph(annotationId, annotationMetadata, graph) {
	var self = this;
	self.getAnnotationItems(annotationId, annotationMetadata, graph);

}

function getAnnotationGraph(annotationMetadata, annotationId) {
    var self = this,
    args = {
        url: annotationServerApi + "open/annotations/" + annotationId + "/graph",
        headers : {"Accept": "application/json"},
        handleAs: "json",
        load: function(r) {
            self.handleAnnotationGraph(annotationId, annotationMetadata, r);
        },
        error: function(error) {
        }
    };
    dojo.xhrGet(args);
}

function getNotebookAnnotations(notebookId) {
    var self = this,
    args = {
        url: annotationServerApi + "open/notebooks/" + notebookId + "/annotations/metadata",
        headers : {"Accept": "application/json"},
        handleAs: "json",
        load: function(r) {
            self.handleNotebookAnnotationsMetadata(r);
        },
        error: function(error) {
        }
    };
    dojo.xhrGet(args);
}

function getAnnotationItems(annotationId, annotationMetadata, graph) {
    var self = this,
    args = {
        url: annotationServerApi + "open/annotations/" + annotationId + "/items",
        headers : {"Accept": "application/json"},
        handleAs: "json",
        load: function(r) {
            self.handleAnnotationMetadataAndGraphAndItems(annotationMetadata, graph,r);
        },
        error: function(error) {
        }
    };
    dojo.xhrGet(args);
}
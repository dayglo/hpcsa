//csautils

require('es6-promise').polyfill();
require('prfun');
rest = require('restler-q').spread;
var S = require('string');
var request = require('request');
var moment = require('moment');
chalk = require('chalk');

csaUtils = {}
 
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

csaUtils.getPropertyPayload = function (global_id, name , value, type) {

	type = type.toUpperCase();

	if (  Array.isArray(value) ) {
		type = "LIST"
	}

	if (type == "INTEGER") {
		type = "NUMBER"
	}

	var payload = {
			"@type": "",
			"description": "",
			"ext": {
					"csa_confidential": false,
					"csa_consumer_visible": true,
					"csa_critical_system_object": false,
					"csa_name_key": name
			},
			"global_id": null,
			"name": name,
			"owner": {
					"global_id": global_id
			},
			"ownership": null,
			"property_type": type,
			"property_value": value
	}

	if (type == "LIST") {

		var values = value.map(function(v){
			return {
			"value_type" : "STRING",
			"value" : v,
			"name" : v,
			"description" : ""
			}
		});

		payload.property_value = values;
	} 

	return payload;
}

csaUtils.getComponentPayload = function ( name , description , consumerVisible) {   
		var propName = name.toUpperCase().replace(' ','');

		return {
			"global_id": null,
			"@type": "",
			"name": name,
			"description": description,
			"icon": "/csa/api/blobstore/other.png?tag=library",
			"ext": {
				"csa_critical_system_object": false,
				"csa_name_key": propName,
				"csa_consumer_visible": consumerVisible,
				"csa_pattern": false,
				"csa_parent": null
			}
		}
}

csaUtils.loginAndGetToken =  function (baseUrl , credentialData ,IdmCallOptions) {

	return new Promise(function(resolve, reject) {
		console.log('Authenticating...');

		rest.postJson(baseUrl + 'idm-service/v2.0/tokens/', credentialData ,IdmCallOptions )
		.spread(
			function(data){
				console.log("got token.");
				resolve(data.token.id);
			},
			function(data){
				reject(Error(data.code));       
			}
		);

	});  
}

csaUtils.getTask = function (xAuthToken , payload, url ,httpOptions, desc) {
	return function(){

		return new Promise(function(resolve, reject) {
			console.log(desc);
			rest.postJson(url , payload , httpOptions)
			.spread(
				function(data){
					;
					console.log("     ok!")
					resolve(data);


				},
				function(data){
					;

					if (data.code == "PropertyNameUniquenessError") {
						console.log("     already exists") ;  
						resolve("PropertyNameUniquenessError");

					}else if (S(data).contains('HTTP Status 415')) {
						console.log("     result: failed with 415") ;  
						resolve("failed with 415");

					} else {
						console.log(data);
						reject(Error(data.code));
					}       
				}
				);

		});
	}
}


csaUtils.createParallelTask = function(tasks,desc) {
	return function(){
		return new Promise(function(resolve,reject) {

			console.log('executing ' + desc);

			var executingTasks = tasks.map(function(task) {
				return task();
			})

			return Promise.all(executingTasks)
			.then(function(data){
debugger;
				console.log (desc + ' executed');
				resolve('one of ' + desc + ' worked');
			},function(err){
				console.log (desc + ' did not work '+ err);
				reject(desc + ' - ' + err);
			})
		});
	}
}


function buildRequestOptions(doc , newInputData){
	
		return doc.fields.reduce(function(prev,curr){
			if (typeof newInputData[curr.name] !== "undefined") {
				prev.fields[curr.id] = newInputData[curr.name]
			} else {
				prev.fields[curr.id] = curr.value;
			}
			return prev;
		},{fields:{}})
}

function pollRequest(username, password, baseUrl, xAuthToken , retry) {  
	return function(reqData){
			//console.log(retry);
			retry--;
			if(retry === 0) {
				console.log('           timed out request ' + reqData.reqId);
				return Promise.reject("timed out while polling request status for request " + reqData.reqId);
			} else {
				return Promise.resolve(reqData)
				.then(getRequestStatus(username, password, baseUrl, xAuthToken ))
				.then(function(requestData) {

					if(requestData.requestState === 'REJECTED') {
						//console.log('request rejected');
						return Promise.reject("the request " + reqData.reqId + " was rejected by CSA")
					} else if(requestData.requestState === 'COMPLETED') {
						//console.log('request complete ' );
						return Promise.resolve(requestData);
					} else {
						//console.log('retrigger delay');
						return Promise.delay(reqData, getRandomInt(9000,11000) ).then(pollRequest(username, password, baseUrl, xAuthToken , retry));
					}
				});
			}
	}
}

function getRequestStatus(username, password, baseUrl, xAuthToken ) {
	return function(reqData){
		return new Promise(function(resolve, reject) {
				var desc = "    checking progress on request " + reqData.reqId;
				console.log(desc);

				var authString = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

				var headers = {
					"Authorization" : authString,
					"X-Auth-Token" : xAuthToken
				};

				var options = {
					rejectUnauthorized: false,
					url: baseUrl + 'csa/api/mpp/mpp-request/' + reqData.reqId + '?catalogId=' + reqData.catalogId,
					headers:headers
				};

				request.get(options, function optionalCallback(err, httpResponse, body) {
					if (err) {
						console.log(' failure while ' + err.message);
						reject(Error(' failure while ' + err.message)); 
					} else {
						bodyData = JSON.parse(body)
						resolve(bodyData);
					}
			});
		})
	}
}


function sendSubscriptionRequest(username,password,url,xAuthToken, requestObject , desc , catalogId){
	return function(){
		return new Promise(function(resolve, reject) {
			console.log(desc);

			var authString = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

			var headers = {
				"Authorization" : authString,
				"X-Auth-Token" : xAuthToken
			};

			var formData = {
				requestForm : JSON.stringify(requestObject)
			};

			var options = {
				method: 'POST',
				headers: headers,
				rejectUnauthorized: false,
				url: url,
				formData: formData
			};

			request.post(options, function optionalCallback(err, httpResponse, body) {
				if (err) {
					var errorString = '  request' + chalk.red(' not accepted ') + desc + '-' + err.message;
					console.log(errorString);
					reject(Error(errorString)); 
				} else {
					debugger;
					var reqId = JSON.parse(body).id;
					console.log('  request ' +chalk.green('accepted') +': ' + desc + ' - Request ID:' + reqId )
					resolve({reqId:reqId , catalogId:catalogId} );
				}
			});

		});
	}
}



csaUtils.submitRequest = function (username, password, action , baseUrl , offeringId , catalogId, categoryName, offeringData , newInputData , subName , xAuthToken ) {
	return function(){
//try a promise here?

	
		var desc = ["submitting" , action , "request for sub: " , subName].join(' ');
		var subscriptionRequestUrl = baseUrl + 'csa/api/mpp/mpp-request/' + offeringId + '?catalogId=' + catalogId;
		debugger;
		var subOptions = buildRequestOptions(offeringData , newInputData ).fields  

		var subRequestDetails = {
			categoryName: categoryName,
			subscriptionName: subName,
			startDate:  moment().format('YYYY-MM-DDTHH:mm:ss') + '.000Z',
			fields: subOptions ,
			action: action
		}
		debugger;
		var chain = sendSubscriptionRequest(username, password, subscriptionRequestUrl, xAuthToken, subRequestDetails , desc , catalogId)()
		.then(pollRequest(username, password, baseUrl, xAuthToken , 20))
		.then(function(requestData){
			console.log(["      request" , requestData.id ,"(subscription" , requestData.subscription.displayName , ')' , 'was', chalk.green('successfully fulfilled')].join(' '));
			return requestData;
		},function(err){
			console.log("      request for subscription " + subName + chalk.red(' failed') + ': ' + err);
			return(err)
		});
		return chain;
	}
}


 
module.exports = csaUtils;
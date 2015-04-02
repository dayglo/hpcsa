creds = require('./creds');
csaUtils = require('./csaUtils');
uploadFile = require('./uploadFile');
Q = require('q');
chalk = require('chalk');

var argv = require('minimist')(process.argv.slice(2));
offeringId  = argv._[0];
catalogId  = argv._[1];
categoryName  = argv._[2];
chunks  = argv._[3];
tasksPerChunk = argv._[4];


var baseUrl = creds.baseUrl; // this format "https://vm01:8444/"

var credentialData = {
	"passwordCredentials" :
	{
		"username" : creds.u,
		"password" : creds.pw
	},
	"tenantName" : creds.org
};
httpOptions = {
	rejectUnauthorized : false,
	username: creds.u,
	password: creds.pw
}
IdmCallOptions = {
	rejectUnauthorized : false,
	username: creds.idmU,
	password: creds.idmPw
}



function bulksub(offeringId , catalogId , categoryName , chunks , tasksPerChunk) {

	offeringUrl = baseUrl + 'csa/api/mpp/mpp-offering/' + offeringId + '?catalogId=' + catalogId + '&category=' + categoryName;

	csaUtils.loginAndGetToken(baseUrl , credentialData ,IdmCallOptions)
	.then(function(xAuthToken){

		console.log( 'xauthtoken: \n\n' + xAuthToken + '\n');

		var myHttpOptions = httpOptions;
		myHttpOptions.headers = { 'Accept': 'application/json' };
		myHttpOptions.headers['X-Auth-Token'] = xAuthToken;

		return rest.get(offeringUrl , myHttpOptions)
		.spread(function(offeringData){

			var allParallelTasks = new Array();

			for (var i = 0 ; i < chunks ; i++) {
				//build an array of subscription request tasks.
				var tasks = new Array();
				for (var j = 0 ; j < tasksPerChunk ; j++) {
					tasks.push(csaUtils.requestSubscription(creds.u, creds.pw, baseUrl ,offeringId , catalogId, categoryName, offeringData ,  "bulk test " + i + '.' + j , xAuthToken ));
				}
				// create a new ubertask, which executes this chunk of tasks simultaneously.
				allParallelTasks.push( csaUtils.createParallelTask(tasks , "a chunk of " + tasksPerChunk + " parallel tasks") )
			}

			 //promise magic to invoke all the ubertasks sequentially
			return allParallelTasks.reduce(Q.when, Q('a')).done();

		},function(err){
			console.log("error in main " + err)
		}).then(function(data){
			console.log("Finished setting up work. Starting execution...")
		})

	},function(err){
			debugger;
	})
}
// example: 
// node bulksub.js 2c9030074c745ae6014c74c0ba370b76 2c9030e44b77dd62014b7de363b82048  SOFTWARE  1  1 

bulksub(offeringId , catalogId , categoryName , chunks , tasksPerChunk);






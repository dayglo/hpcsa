//csautils

require('es6-promise').polyfill();
rest = require('restler-q').spread;
var S = require('string');
var request = require('request');

csaUtils = {}
 
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

    rest.postJson(baseUrl + 'idm-service/v2.0/tokens/', credentialData ,IdmCallOptions )
    .spread(
      function(data){
        console.log("logged in.")
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
          debugger;
          console.log("     ok!")
          resolve(data);


        },
        function(data){
          debugger;

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

csaUtils.sendForm = function(username,password,url,xAuthToken){
  return function(){
    return new Promise(function(resolve, reject) {

      var authString = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

      var headers = {
        "Authorization" : authString,
        "X-Auth-Token" : xAuthToken
      };

      var formData = {
        requestForm : '{  "categoryName": "ACCESSORY",  "subscriptionName": "Virtual Linux Server v01.00 (1.0.0)",  "startDate": "2015-03-30T10:47:42.000Z",  "fields": {    "field_2c9030e44c4645c1014c55f364b60d7b": true,    "field_2c9030e44c4645c1014c55f364b70d83": "1",    "field_2c9030e44c4645c1014c55f364b60d7f": "2",    "field_2c9030e44c4645c1014c55f364b60d70": true,    "field_2c9030e44c4645c1014c55f364b70d86": 4,    "field_2c9030e44c4645c1014c55f364b60d74": 1  },  "action": "ORDER"}'
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
          console.log('problem with request: ' + err.message);
          reject(Error('problem with request: ' + err.message)); 
        } else {
          console.log(body);
          resolve(body);
        }
        
      });
    });

  }
}

 
module.exports = csaUtils;
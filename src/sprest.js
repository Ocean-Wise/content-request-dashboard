/* eslint-disable */
import fs from 'fs';
import https from 'https';
import sprLib from 'sprestlib';
import * as d3 from 'd3';
import moment from 'moment';

const SP_USER = 'ethan.dinnen@ocean.org';
const SP_PASS = 'apiginthebin1!';
const SP_URL = 'https://vamsc.sharepoint.com';
const SP_HOST = SP_URL.toLowerCase().replace('https://', '').replace('https://', '');
let gBinarySecurityToken = '';
let gAuthCookie1 = '';
let gAuthCookie2 = '';
let gStrReqDig = '';

let contentRequests = [];
let projectsByYear = {};

// "Future proof"
let projectsByMonth = { 2017: [], 2018: [], 2019: [], 2020: [] };
let projectsBySize = { 2017: [], 2018: [], 2019: [], 2020: [] };
let projectsByDepartment = { 2017: [], 2018: [], 2019: [], 2020: [] };
let projectsByMedia = { 2017: [], 2018: [], 2019: [], 2020: [] };

Promise.resolve()
.then(() => {
	// STEP 1: Login to MS with user/pass and get SecurityToken
	console.log(' * STEP 1/2: Auth into login.microsoftonline.com ...');

	return new Promise((resolve, reject) => {
		const xmlRequest = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">\n' // eslint-disable-line
		+ '  <s:Header>'
		+ '    <a:Action s:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/02/trust/RST/Issue</a:Action>'
		+ '    <a:ReplyTo><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>'
		+ '    <a:To s:mustUnderstand="1">https://login.microsoftonline.com/extSTS.srf</a:To>'
		+ '    <o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">'
		+ '      <o:UsernameToken>'
		+ '        <o:Username>' + SP_USER + '</o:Username>'
		+ '        <o:Password>' + SP_PASS + '</o:Password>'
		+ '      </o:UsernameToken>'
		+ '    </o:Security>'
		+ '  </s:Header>'
		+ '  <s:Body>'
		+ '    <t:RequestSecurityToken xmlns:t="http://schemas.xmlsoap.org/ws/2005/02/trust">'
		+ '      <wsp:AppliesTo xmlns:wsp="http://schemas.xmlsoap.org/ws/2004/09/policy">'
		+ '        <a:EndpointReference><a:Address>' + SP_URL + '</a:Address></a:EndpointReference>'
		+ '      </wsp:AppliesTo>'
		+ '      <t:KeyType>http://schemas.xmlsoap.org/ws/2005/05/identity/NoProofKey</t:KeyType>'
		+ '      <t:RequestType>http://schemas.xmlsoap.org/ws/2005/02/trust/Issue</t:RequestType>'
		+ '      <t:TokenType>urn:oasis:names:tc:SAML:1.0:assertion</t:TokenType>'
		+ '    </t:RequestSecurityToken>'
		+ '  </s:Body>'
		+ '</s:Envelope>';

		const options = {
			hostname: 'login.microsoftonline.com',
			path: '/extSTS.srf',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': xmlRequest.length,
			},
		};

		const request = https.request(options, (res) => {
			let rawData = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => rawData += chunk); // eslint-disable-line
			res.on('end', () => {
				var DOMParser = require('xmldom').DOMParser; // eslint-disable-line
				var doc = new DOMParser().parseFromString(rawData, "text/xml"); // eslint-disable-line
				// KEY 1: Get SecurityToken
				if ( doc.documentElement.getElementsByTagName('wsse:BinarySecurityToken').item(0) ) { // eslint-disable-line
					gBinarySecurityToken = doc.documentElement.getElementsByTagName('wsse:BinarySecurityToken').item(0).firstChild.nodeValue;
					resolve();
				} // eslint-disable-line
				else {
					reject('Invalid Username/Password');
				}
			});
		});
		request.on('error', (e) => {
			console.log(`problem with request: ${e.message}`); // eslint-disable-line
			reject();
		});
		request.write(xmlRequest);
		request.end();
	});
})
.then(() => {
	// STEP 2: Provide SecurityToken to SP site and get 2 Auth Cookies
	console.log(' * STEP 2/2: Auth into SharePoint ...'); // eslint-disable-line

	return new Promise(function(resolve,reject) { // eslint-disable-line
		var options = { // eslint-disable-line
			hostname: SP_HOST, // eslint-disable-line
			agent: false,
			path: "/_forms/default.aspx?wa=wsignin1.0", // eslint-disable-line
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': gBinarySecurityToken.length,
				'Host': SP_HOST // eslint-disable-line
			} // eslint-disable-line
		};

		var request = https.request(options, (response) => { // eslint-disable-line
			// KEY 2: Get 2 auth cookie values
			gAuthCookie1 = response.headers['set-cookie'][0].substring(0,response.headers['set-cookie'][0].indexOf(';')); // eslint-disable-line
			gAuthCookie2 = response.headers['set-cookie'][1].substring(0,response.headers['set-cookie'][1].indexOf(';')); // eslint-disable-line
			resolve();
		});
		request.on('error', (e) => {
			console.log(`problem with request: ${e.message}`); // eslint-disable-line
			reject(e);
		});
		request.write(gBinarySecurityToken);
		request.end();
	});
})
.then((data) => { // eslint-disable-line
	// STEP 3: Send requests including authentication cookies
	console.log(' * SUCCESS!! Authenticated into "'+ SP_HOST +'"'); // eslint-disable-line
	// console.log(`...gAuthCookie1:\n${gAuthCookie1}\n`);
	// console.log(`...gAuthCookie2:\n${gAuthCookie2}\n`);

	// A: SpRestLib requires 2 things: auth-cookie & server-name
	sprLib.nodeConfig({ cookie:gAuthCookie1+' ;'+gAuthCookie2, server:SP_HOST }); // eslint-disable-line

	// B: SpRestLib also needs the full path to your site
	sprLib.baseUrl('/Engagement/Content/CR');
	// console.log( 'sprLib.baseUrl = '+ sprLib.baseUrl() );

	// C: Now run all the sprLib API calls you want
	// return sprLib.user().info();
	return sprLib.list({'name': 'Content Requests'}).items({ queryLimit: 5000 });
	// return sprLib.site().lists();
})
// .then((lists) => {
// 	console.log(lists);
// })
.then((requestItems) => {
	// console.log(requestItems); // eslint-disable-line
	// console.log(requestItems.length); // eslint-disable-line

	// $('#app').append(requestItems[5].Description);

	requestItems.map((request) => {
		let year = moment(request.Created).format('YYYY');
		let month = parseInt(moment(request.Created).format('MM'));
		console.log(month);
		let department = request.Department;
		let destination = request.Destination.results[0];
		let size = request.Category;
		if (projectsByYear[year] === undefined) {

			projectsByYear[year] = [request];

			if (projectsByMonth[year][month] === undefined) {
				projectsByMonth[year][month] = [request];
			} else {
				projectsByMonth[year][month] = projectsByMonth[year][month].concat([request]);
			}

			if (projectsByDepartment[year][department] === undefined) {
				projectsByDepartment[year][department] = [request];
			} else {
				projectsByDepartment[year][department] = projectsByDepartment[year][department].concat([request]);
			}

			if (projectsByMedia[year][destination] === undefined) {
				projectsByMedia[year][destination] = [request];
			} else {
				projectsByMedia[year][destination] = projectsByDepartment[year][department].concat([request]);
			}

			if (projectsBySize[year][size] === undefined) {
				projectsBySize[year][size] = [request];
			} else {
				projectsBySize[year][size] = projectsBySize[year][size].concat([request]);
			}

		} else {
			projectsByYear[year] = projectsByYear[year].concat([request]);
			if (projectsByMonth[year][month] === undefined) {
				projectsByMonth[year][month] = [request];
			} else {
				projectsByMonth[year][month] = projectsByMonth[year][month].concat([request]);
			}
			if (projectsByDepartment[year][department] === undefined) {
				projectsByDepartment[year][department] = [request];
			} else {
				projectsByDepartment[year][department] = projectsByDepartment[year][department].concat([request]);
			}
			if (projectsByMedia[year][destination] === undefined) {
				projectsByMedia[year][destination] = [request];
			} else {
				projectsByMedia[year][destination] = projectsByDepartment[year][department].concat([request]);
			}
			if (projectsBySize[year][size] === undefined) {
				projectsBySize[year][size] = [request];
			} else {
				projectsBySize[year][size] = projectsBySize[year][size].concat([request]);
			}
		}
	});
	// console.log(projectsByYear);
	console.log(projectsByMonth);
	// console.log(projectsByDepartment);
	// console.log(projectsByMedia);
	// console.log(projectsBySize);
	return true;
})
.then(() => {
	let color = d3.scaleOrdinal(d3.schemeCategory20c);
	let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	let data = projectsByMonth[2017].map((month, i) => {
		console.log(month);
		console.log(i);
		return { label: months[i-1], value: month.length, color: color[i] };
	});
	data = data.filter(value => Object.keys(value).length !== 0);
	return data;
})
.then((data) => {

	console.log("pie-ing");



	console.log(data);

	var pie = new d3pie('pieChart', {
		"header": {
			"title": {
				"text": "Projects by Month",
				"fontSize": 24,
				"font": "open sans"
			},
		},
		"footer": {
			"color": "#999999",
			"fontSize": 10,
			"font": "open sans",
			"location": "bottom-left"
		},
		"size": {
			"canvasWidth": 590,
			"pieOuterRadius": "90%"
		},
		"data": {
			"sortOrder": "value-desc",
			"content": data
		},
		"labels": {
			"outer": {
				"pieDistance": 32
			},
			"inner": {
				"hideWhenLessThanPercentage": 3,
			},
			"mainLabel": {
				"fontSize": 11
			},
			"percentage": {
				"color": "#ffffff",
				"decimalPlaces": 0
			},
			"value": {
				"color": "#adadad",
				"fontSize": 11
			},
			"lines": {
				"enabled": true
			},
			"truncation": {
				"enabled": true
			}
		},
		"effects": {
			"pullOutSegmentOnClick": {
				"effect": "linear",
				"speed": 400,
				"size": 8
			}
		},
		"misc": {
			"gradient": {
				"enabled": true,
				"percentage": 100
			}
		}
	});
});
/* eslint-enable */

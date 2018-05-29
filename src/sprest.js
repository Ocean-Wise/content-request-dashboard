/* eslint-disable */
import fs from 'fs';
import https from 'https';
import sprLib from 'sprestlib';
import * as d3 from 'd3';
import moment from 'moment';
const svgToImg = require('svg-to-img');

const SP_USER = 'ethan.dinnen@ocean.org';
const SP_PASS = 'apiginthebin1!';
const SP_URL = 'https://vamsc.sharepoint.com';
const SP_HOST = SP_URL.toLowerCase().replace('https://', '').replace('https://', '');
let gBinarySecurityToken = '';
let gAuthCookie1 = '';
let gAuthCookie2 = '';
let gStrReqDig = '';

const currentYearSelector = document.getElementById('yearSelector');
let currentYear = currentYearSelector.options[currentYearSelector.selectedIndex].value;

const departments = ['Animal Care', 'Content', 'HR', 'Volunteer Services', 'Brand', 'Admin', 'CORI', 'Catering & Events', 'Communications', 'Content', 'Design', 'Education', 'Exhibits', 'External Relations', 'GCSC', 'Guest Services', 'Interpreters', 'Marine Mammal Rescue', 'Marketing', 'Ocean Wise Seafood', 'Other', 'Research', 'Retail', 'Social Media'];
const mediaTypes = ['Video', 'Web', '360', 'Audio', 'Email', 'Retail', 'Media Release', 'Mobile', 'Print', 'Screen', 'Exhibits', 'Other'];
const projectSizes = ['Small', 'Medium', 'Large'];

let contentRequests = [];
let projectsByYear = {};

// "Future proof"
let projectsByMonth = { 2017: [], 2018: [], 2019: [], 2020: [], 2021: [], 2022: [], 2023: [], 2024: [], 2025: [], 2026: [], 2027: [], 2028: [], 2029: [], 2030: [] };
let projectsBySize = { 2017: [], 2018: [], 2019: [], 2020: [], 2021: [], 2022: [], 2023: [], 2024: [], 2025: [], 2026: [], 2027: [], 2028: [], 2029: [], 2030: [] };
let projectsByDepartment = { 2017: [], 2018: [], 2019: [], 2020: [], 2021: [], 2022: [], 2023: [], 2024: [], 2025: [], 2026: [], 2027: [], 2028: [], 2029: [], 2030: [] };
let projectsByMedia = { 2017: [], 2018: [], 2019: [], 2020: [], 2021: [], 2022: [], 2023: [], 2024: [], 2025: [], 2026: [], 2027: [], 2028: [], 2029: [], 2030: [] };

// Plot variables
let projectsByMonthPlot;
let projectsByDepartmentPlot;
let projectsByMediaPlot;
let projectsBySizePlot;

// Below are the functions that handle actual exporting:
// getSVGString ( svgNode ) and svgString2Image( svgString, width, height, format, callback )
function getSVGString( svgNode ) {
	svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
	var cssStyleText = getCSSStyles( svgNode );
	appendCSS( cssStyleText, svgNode );

	var serializer = new XMLSerializer();
	var svgString = serializer.serializeToString(svgNode);
	svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
	svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix

	return svgString;

	function getCSSStyles( parentElement ) {
		var selectorTextArr = [];

		// Add Parent element Id and Classes to the list
		selectorTextArr.push( '#'+parentElement.id );
		for (var c = 0; c < parentElement.classList.length; c++)
				if ( !contains('.'+parentElement.classList[c], selectorTextArr) )
					selectorTextArr.push( '.'+parentElement.classList[c] );

		// Add Children element Ids and Classes to the list
		var nodes = parentElement.getElementsByTagName("*");
		for (var i = 0; i < nodes.length; i++) {
			var id = nodes[i].id;
			if ( !contains('#'+id, selectorTextArr) )
				selectorTextArr.push( '#'+id );

			var classes = nodes[i].classList;
			for (var c = 0; c < classes.length; c++)
				if ( !contains('.'+classes[c], selectorTextArr) )
					selectorTextArr.push( '.'+classes[c] );
		}

		// Extract CSS Rules
		var extractedCSSText = "";
		for (var i = 0; i < document.styleSheets.length; i++) {
			var s = document.styleSheets[i];

			try {
			    if(!s.cssRules) continue;
			} catch( e ) {
		    		if(e.name !== 'SecurityError') throw e; // for Firefox
		    		continue;
		    	}

			var cssRules = s.cssRules;
			for (var r = 0; r < cssRules.length; r++) {
				if ( contains( cssRules[r].selectorText, selectorTextArr ) )
					extractedCSSText += cssRules[r].cssText;
			}
		}


		return extractedCSSText;

		function contains(str,arr) {
			return arr.indexOf( str ) === -1 ? false : true;
		}

	}

	function appendCSS( cssText, element ) {
		var styleElement = document.createElement("style");
		styleElement.setAttribute("type","text/css");
		styleElement.innerHTML = cssText;
		var refNode = element.hasChildNodes() ? element.children[0] : null;
		element.insertBefore( styleElement, refNode );
	}
}


function svgString2Image( svgString, width, height, format, callback ) {
	var format = format ? format : 'png';

	var imgsrc = 'data:image/svg+xml;base64,'+ btoa( unescape( encodeURIComponent( svgString ) ) ); // Convert SVG string to data URL

	var canvas = document.createElement("canvas");
	var context = canvas.getContext("2d");

	canvas.width = width;
	canvas.height = height;

	var image = new Image();
	image.onload = function() {
		context.clearRect ( 0, 0, width, height );
		context.drawImage(image, 0, 0, width, height);

		canvas.toBlob( function(blob) {
			var filesize = Math.round( blob.length/1024 ) + ' KB';
			if ( callback ) callback( blob, filesize );
		});


	};

	image.src = imgsrc;
}


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
.then((requestItems) => {

	// Loop over all the content requests
	requestItems.map((request) => {
		// Create variables for the necessary information
		let year = parseInt(moment(request.Created).format('YYYY'));
		let month = parseInt(moment(request.Created).format('MM'));

		// Deal with the mess that is the Department field
		let department = request.Department;
		if (department === 'Social M') department = 'Social Media';
		if (department === 'Content ') department = 'Content';
		if (department === 'catering & events' || department === 'Catering and Events' || department === 'Catering and Events ') department = 'Catering & Events';
		if (department === 'Communcations' || department === 'Communication' || department === 'communications' || department === 'Communications ') department = 'Communications';
		if (department === 'Volunteers') department = 'Volunteer Services';
		if (department === 'education') department = 'Education';
		department = departments.indexOf(department);
		if (department === -1) department = departments.indexOf('Other');

		// Deal with the other mess that is the destination field
		let destination = request.Destination.results[0];
		if (destination.includes('audio') || destination.includes('Audio')) destination = 'Audio';
		if (destination.includes('gallery') || destination.includes('Gallery') || destination.includes('exhibit') || destination.includes('Exhibit') || destination.includes('graphic panel')) destination = 'Exhibits';
		if (destination.includes('Media release')) destination = 'Media Release';
		if (destination.includes('Website')) destination = 'Web';
		if (destination.includes('Email') || destination.includes('email')) destination = 'Email';
		if (destination.includes('Retail') || destination.includes('retail')) destination = 'Retail';
		destination = mediaTypes.indexOf(destination);
		if (destination === -1) {
			destination = mediaTypes.indexOf('Other');
		}


		let size = projectSizes.indexOf(request.Category);

		// Sort the projects into the various arrays defined earlier
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

	return true;
})
.then(() => {
	let color = d3.scaleOrdinal(d3.schemeCategory20c);
	let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	let data = projectsByMonth[currentYear].map((month, i) => {
		return { label: months[i-1], value: month.length, color: color[i] };
	});
	data = data.filter(value => Object.keys(value).length !== 0);
	return data;
})
.then((data) => {
	// Create a pie chart for Projects by Month
	(async () => {
		var pie = await new d3pie('projectsByMonth', {
			"header": {
				"title": {
					"text": `Projects by Month for ${currentYear}`,
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
		// Add the download button which allows the user to save the plot as a png file
		d3.select('#projectsByMonth')
			.append("button")
			.attr('type', 'button')
			.attr('class', 'btn-btn')
			.on('click', () => {
				try {
					const svg = getSVGString(document.getElementById('projectsByMonth').childNodes[0]);
					svgString2Image( svg, 2*590, 2*500, 'png', save );

					function save( dataBlob, filesize ) {
						saveAs( dataBlob, `projectsByMonth${currentYear}.png` );
					}
				} catch (err) {
					console.log(err);
				}
			})
			.append('div')
			.attr('class', 'label')
			.text('Save as PNG');
	})();
	return true;
})
.then(() => {
	let color = d3.scaleOrdinal(d3.schemeCategory20c);
	let data = projectsByDepartment[currentYear].map((department, i) => {
		return { label: departments[i], value: department.length, color: color[i] };
	});
	data = data.filter(value => Object.keys(value).length !== 0);
	return data;

})
.then((data) => {
	// Create a pie chart for Projects by Department
	(async () => {
		projectsByDepartmentPlot = await new d3pie('projectsByDepartment', {
			"header": {
				"title": {
					"text": `Projects by Department for ${currentYear}`,
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
		// Add the download button which allows the user to save the plot as a png file
		d3.select('#projectsByDepartment')
			.append("button")
			.attr('type', 'button')
			.attr('class', 'btn-btn')
			.on('click', () => {
				try {
					const svg = getSVGString(document.getElementById('projectsByDepartment').childNodes[0]);
					svgString2Image( svg, 2*590, 2*500, 'png', save );

					function save( dataBlob, filesize ) {
						saveAs( dataBlob, `projectsByDepartment${currentYear}.png` );
					}
				} catch (err) {
					console.log(err);
				}
			})
			.append('div')
			.attr('class', 'label')
			.text('Save as PNG');
	})();
	return true;
})
.then(() => {
	let color = d3.scaleOrdinal(d3.schemeCategory20c);
	let data = projectsByMedia[currentYear].map((media, i) => {
		return { label: mediaTypes[i], value: media.length, color: color[i] };
	});
	data = data.filter(value => Object.keys(value).length !== 0);
	return data;

})
.then((data) => {
	// Create a pie chart for Projects by Media
	(async () => {
		projectsByMediaPlot = await new d3pie('projectsByMedia', {
			"header": {
				"title": {
					"text": `Projects by Media for ${currentYear}`,
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
		// Add the download button which allows the user to save the plot as a png file
		d3.select('#projectsByMedia')
			.append("button")
			.attr('type', 'button')
			.attr('class', 'btn-btn')
			.on('click', () => {
				try {
					const svg = getSVGString(document.getElementById('projectsByMedia').childNodes[0]);
					svgString2Image( svg, 2*590, 2*500, 'png', save );

					function save( dataBlob, filesize ) {
						saveAs( dataBlob, `projectsByMedia${currentYear}.png` );
					}
				} catch (err) {
					console.log(err);
				}
			})
			.append('div')
			.attr('class', 'label')
			.text('Save as PNG');
	})();
	return true;
})
.then(() => {
	let color = d3.scaleOrdinal(d3.schemeCategory20c);
	let data = projectsBySize[currentYear].map((size, i) => {
		return { label: projectSizes[i], value: size.length, color: color[i] };
	});
	data = data.filter(value => Object.keys(value).length !== 0);
	return data;

})
.then((data) => {
	// Create a pie chart for Projects by Size
	(async () => {
		projectsBySizePlot = await new d3pie('projectsBySize', {
			"header": {
				"title": {
					"text": `Projects by Size for ${currentYear}`,
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
		// Add the download button which allows the user to save the plot as a png file
		d3.select('#projectsBySize')
			.append("button")
			.attr('type', 'button')
			.attr('class', 'btn-btn')
			.on('click', () => {
				try {
					const svg = getSVGString(document.getElementById('projectsBySize').childNodes[0]);
					svgString2Image( svg, 2*590, 2*500, 'png', save );

					function save( dataBlob, filesize ) {
						saveAs( dataBlob, `projectsBySize${currentYear}.png` );
					}
				} catch (err) {
					console.log(err);
				}
			})
			.append('div')
			.attr('class', 'label')
			.text('Save as PNG');
	})();
	return true;
});

function clearPlots() {
	document.getElementById('projectsByMonth').innerHTML = '';
	document.getElementById('projectsByDepartment').innerHTML = '';
	document.getElementById('projectsByMedia').innerHTML = '';
	document.getElementById('projectsBySize').innerHTML = '';
}

function plot() {
	clearPlots();
	currentYear = currentYearSelector.options[currentYearSelector.selectedIndex].value;
	Promise.resolve()
	.then(() => {
		let color = d3.scaleOrdinal(d3.schemeCategory20c);
		let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		let data = projectsByMonth[currentYear].map((month, i) => {
			return { label: months[i-1], value: month.length, color: color[i] };
		});
		data = data.filter(value => Object.keys(value).length !== 0);
		return data;
	})
	.then((data) => {
		if (data.length === 0) {
			d3.select('#projectsByMonth')
			.text('No month data for this year');
	 	} else {
			// Create a pie chart for Projects by Month
			(async () => {
				var pie = await new d3pie('projectsByMonth', {
					"header": {
						"title": {
							"text": `Projects by Month for ${currentYear}`,
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
				// Add the download button which allows the user to save the plot as a png file
				d3.select('#projectsByMonth')
					.append("button")
					.attr('type', 'button')
					.attr('class', 'btn-btn')
					.on('click', () => {
						try {
							const svg = getSVGString(document.getElementById('projectsByMonth').childNodes[0]);
							svgString2Image( svg, 2*590, 2*500, 'png', save );

							function save( dataBlob, filesize ) {
								saveAs( dataBlob, `projectsByMonth${currentYear}.png` );
							}
						} catch (err) {
							console.log(err);
						}
					})
					.append('div')
					.attr('class', 'label')
					.text('Save as PNG');
			})();
		}
		return true;
	})
	.then(() => {
		let color = d3.scaleOrdinal(d3.schemeCategory20c);
		let data = projectsByDepartment[currentYear].map((department, i) => {
			return { label: departments[i], value: department.length, color: color[i] };
		});
		data = data.filter(value => Object.keys(value).length !== 0);
		return data;

	})
	.then((data) => {
		if (data.length === 0) {
			d3.select('#projectsByDepartment')
			.text('No department data for this year');
	 	} else {
			// Create a pie chart for Projects by Department
			(async () => {
				projectsByDepartmentPlot = await new d3pie('projectsByDepartment', {
					"header": {
						"title": {
							"text": `Projects by Department for ${currentYear}`,
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
				// Add the download button which allows the user to save the plot as a png file
				d3.select('#projectsByDepartment')
					.append("button")
					.attr('type', 'button')
					.attr('class', 'btn-btn')
					.on('click', () => {
						try {
							const svg = getSVGString(document.getElementById('projectsByDepartment').childNodes[0]);
							svgString2Image( svg, 2*590, 2*500, 'png', save );

							function save( dataBlob, filesize ) {
								saveAs( dataBlob, `projectsByDepartment${currentYear}.png` );
							}
						} catch (err) {
							console.log(err);
						}
					})
					.append('div')
					.attr('class', 'label')
					.text('Save as PNG');
			})();
		}
		return true;
	})
	.then(() => {
		let color = d3.scaleOrdinal(d3.schemeCategory20c);
		let data = projectsByMedia[currentYear].map((media, i) => {
			return { label: mediaTypes[i], value: media.length, color: color[i] };
		});
		data = data.filter(value => Object.keys(value).length !== 0);
		return data;

	})
	.then((data) => {
		if (data.length === 0) {
			d3.select('#projectsByMedia')
			.text('No media data for this year');
	 	} else {
			// Create a pie chart for Projects by Media
			(async () => {
				projectsByMediaPlot = await new d3pie('projectsByMedia', {
					"header": {
						"title": {
							"text": `Projects by Media for ${currentYear}`,
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
				// Add the download button which allows the user to save the plot as a png file
				d3.select('#projectsByMedia')
					.append("button")
					.attr('type', 'button')
					.attr('class', 'btn-btn')
					.on('click', () => {
						try {
							const svg = getSVGString(document.getElementById('projectsByMedia').childNodes[0]);
							svgString2Image( svg, 2*590, 2*500, 'png', save );

							function save( dataBlob, filesize ) {
								saveAs( dataBlob, `projectsByMedia${currentYear}.png` );
							}
						} catch (err) {
							console.log(err);
						}
					})
					.append('div')
					.attr('class', 'label')
					.text('Save as PNG');
			})();
		}
		return true;
	})
	.then(() => {
		let color = d3.scaleOrdinal(d3.schemeCategory20c);
		let data = projectsBySize[currentYear].map((size, i) => {
			return { label: projectSizes[i], value: size.length, color: color[i] };
		});
		data = data.filter(value => Object.keys(value).length !== 0);
		return data;

	})
	.then((data) => {
		if (data.length === 0) {
			d3.select('#projectsBySize')
			.text('No size data for this year');
	 	} else {
			// Create a pie chart for Projects by Size
			(async () => {
				projectsBySizePlot = await new d3pie('projectsBySize', {
					"header": {
						"title": {
							"text": `Projects by Size for ${currentYear}`,
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
				// Add the download button which allows the user to save the plot as a png file
				d3.select('#projectsBySize')
					.append("button")
					.attr('type', 'button')
					.attr('class', 'btn-btn')
					.on('click', () => {
						try {
							const svg = getSVGString(document.getElementById('projectsBySize').childNodes[0]);
							svgString2Image( svg, 2*590, 2*500, 'png', save );

							function save( dataBlob, filesize ) {
								saveAs( dataBlob, `projectsBySize${currentYear}.png` );
							}
						} catch (err) {
							console.log(err);
						}
					})
					.append('div')
					.attr('class', 'label')
					.text('Save as PNG');
			})();
		}
		return true;
	});
}
/* eslint-enable */

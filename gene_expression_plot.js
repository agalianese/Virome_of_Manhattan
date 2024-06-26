async function performGeneFetch(genePatients, my_Ids) {

	//identify the user selections
	//CHANGES SN 11/21/2022
	//Called new functions to alter gene list
	let genes = modifyGeneList(document.getElementById("inputgene").value).split(",");//.toUpperCase().trim().split(",")
	let myPtids = genePatients.splice(",")
	let myPatients = my_Ids.split(",")

	console.log("Patients " + myPtids + " genes " + genes)

	//empty array of scores and dates
	var allDates = []; infectTypes = [], infectVals = [], max = 0, myDataset = [];

	//grab all associated cgcids
	for (pat in myPtids) {

		var [{ myDates, cgcIds }] = await getCgcIds(myPtids[pat])

		allDates = allDates.concat(myDates)

		for (gene in genes) {
			let myGene = genes[gene].trim();

			//Sending info to the backend via a fetch command
			let response = await fetch(URL + 'list/counts/?gene=' + myGene)
			let data = await response.json();

			var myScores = [];

			//iterate through each JSON line and push the associated symptom score and date to its array
			for (let x = 0; x < cgcIds.length; x++) {
				//identify which cgcid is being used

				let myScore = (Math.log10(data[0][cgcIds[x]] + 1))
				myScores.push({ x: myDates[x], y: myScore })

				if (myScore > max) { max = myScore }
                           
			} // end of x in cgcIds

			myDataset[myDataset.length] = {
				data: myScores,
				label: "Patient: " + myPatients[pat] + " | Gene: " + genes[gene],
				backgroundColor: colors[myDataset.length],
				borderColor: colors[myDataset.length],
				showLine: true
			}


		} //end of gene in genes
	} //end of in patients

	//remove duplicated date values then sort
	var uniqueDates = allDates.filter((value, index) => {
		return allDates.indexOf(value) === index;
	});

	let myLabels = uniqueDates.sort(function (a, b) { return a - b });
	myDataset = await getGEInfections(myPatients, myPtids, myDataset, myLabels, max)
	return [{ myLabels, myDataset }]

}//end of performGeneFetch()

//CHANGES SN 11/21/2022
//Created new functions to clean up input symptom and gene data
function modifyGeneList(rawinput) {
	var genes = [...new Set(rawinput.replaceAll('.', ',').replace(/\s/g, '').toUpperCase().split(",").filter(n => n))];
	return genes.join(", ");
} //sanjay, you forgot the closing bracket :)

function modifyPatientList(rawinput) {
	let patient = [...new Set(rawinput.replaceAll('.', ',').replace(/\s/g, '').split(",").filter(n => n))];
	return patient.join(",");
}

async function submitGeneInfo() {
	//let genes = document.getElementById("inputgene").value.toUpperCase().trim();
	//CHANGES SN 11/21/2022, called new functions to alter visible graph title, patient labels

	let genes = modifyGeneList(document.getElementById("inputgene").value);//.toUpperCase().trim();
	let myPatients = modifyPatientList(document.getElementById("genepatient").value.toString());

	let myPtIds = await getPt_Id(myPatients);

	//retrieve all scores and dates from a patient
	var [{ myLabels, myDataset }] = await performGeneFetch(myPtIds, myPatients)

	let chartStatus = Chart.getChart("geneChart");
	if (chartStatus != undefined) {
		chartStatus.destroy()
	} //end of destroying chart

	window.myChart = new Chart(document.getElementById("geneChart").getContext('2d'), {
		type: "line",
		data: { labels: myLabels, datasets: myDataset },
		options: {
			responsive: true,
			plugins: {
				title: {
					display: true,
					text: "Gene Expression of Patient(s) " + myPatients + " for " + genes,
					font: { size: 20, weight: 'bold' }
				} //title 
			}, scales: {
				x: { title: { display: true, text: 'Days' } },
				y: { title: { display: true, text: "Gene Expression (Log(x + 1))" } }
			}
		}
	}); //end of chart

} //end of submitInfo()

async function getPt_Id(myIds) {

	let splitIds = myIds.split(","), returnIds = []
	let test = await fetch(URL + 'list/ptids/')
	let testDat = await test.json();
	const ptids = testDat.map(item => item.ptid);

	for (myId in splitIds) {
		returnIds.push(ptids[Number(splitIds[myId]-1)]);
	}

	return returnIds
}

async function getCgcIds(patient) {

	let cgcResponse = await fetch(URL + 'list/virus/?ptid=' + patient)
	let cgcData = await cgcResponse.json();

	//try creating date and cgcId maps, faster than for loop
	var myDateMap = cgcData.map(item => item.date_collected);
	var cgcIds = cgcData.map(item => item.cgcid.toLowerCase());

	//put dates into set to remove duplicates, then turn back into array and sort
	var dateSet = new Set(myDateMap);
	var myDates = [...dateSet];
	myDates.sort((a, b) => a - b);

	return [{ myDates, cgcIds }]
}

async function getGEInfections(patients, myIds, myDataset, myLabels, max) {

	//iterate through patients and log their associated virus
	for (j = 0; j < infectList.length; j++) {
		let myInfection = infectList[j]

		for (pat in patients) {

			let patResponse = await fetch(URL + 'list/virus/?infection_type=' + myInfection + "&ptid=" + myIds[pat])
			let patData = await patResponse.json()

			if (patData.length > 0) {
				let infectVals = new Array(myLabels.length).fill(0), activeInfection = false
				
				if (patData.length)
				//sort data according to date before proceedig
				patData.sort(function (a, b) {
					let date_a = parseInt(a.date_collected), date_b = parseInt(b.date_collected);
					return date_a - date_b;
				});

				//iterate through and replace 0 with 1 when an infection occurs
				for (i = 0; i < patData.length; i++) {
					activeInfection = true
					infectVals.splice(myLabels.indexOf(patData[i].date_collected), 1, max)
				} //end of i in patData

				let currentColor = getColors(myInfection);

				//if there's an infection, fill out the dataset with the information
				if (activeInfection && myInfection != "None") {
					myDataset[myDataset.length] = {
						data: infectVals,
						labels: myLabels,
						barThickness: 15,
						label: myInfection + " | Patient " + patients[pat],
						backgroundColor: currentColor,
						borderColor: currentColor,
						type: "bar"
					}
				}
			} //end of if patLength > 0
		}// end of pat in pats
	} //end of infect in infectList

	return myDataset;
}
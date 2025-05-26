// Function to save selected paper and set to sessionStorage
function saveSelection() {
    const selectedPaper = document.querySelector('input[name="paper"]:checked');
    const selectedSet = document.querySelector('input[name="set"]:checked');

    if (selectedPaper && selectedSet) {
        sessionStorage.setItem('selectedPaper', selectedPaper.value);
        sessionStorage.setItem('selectedSet', selectedSet.value);

        if (selectedPaper.value === '1') {
            window.location.href = 'paper1.html';
        } else {
            window.location.href = 'paper2.html';
        }
    } else {
        alert('Please select both Paper and Set to proceed.');
    }
}

// Function to load and parse CSV data
async function loadAnswerKeys() {
    try {
        const response = await fetch('answer_keys.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        return parseCSV(text);
    } catch (error) {
        console.error("Error loading answer keys:", error);
        alert("Failed to load answer keys. Please ensure 'answer_keys.csv' exists and is correctly formatted.");
        return []; // Return empty array to prevent further errors
    }
}

// Simple CSV parser
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) {
            console.warn(`Skipping malformed row ${i + 1}: ${lines[i]}`);
            continue;
        }
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        data.push(row);
    }
    return data;
}

// Function to calculate and display scores
async function calculateScore() {
    const selectedPaper = sessionStorage.getItem('selectedPaper');
    const selectedSet = sessionStorage.getItem('selectedSet');

    if (!selectedPaper || !selectedSet) {
        alert('Paper and Set selection not found. Please go back to the home page to select them.');
        window.location.href = 'index.html';
        return;
    }

    const answerKeys = await loadAnswerKeys();
    // Assuming coaching names are dynamic from CSV header (excluding first three fixed columns)
    const headers = answerKeys.length > 0 ? Object.keys(answerKeys[0]) : [];
    const coachingInstitutes = headers.filter(h => h !== 'Paper' && h !== 'Set' && h !== 'Question');

    if (coachingInstitutes.length === 0) {
        alert("No coaching institute data found in answer keys. Please check 'answer_keys.csv'.");
        return;
    }

    const results = {};
    coachingInstitutes.forEach(coaching => {
        results[coaching] = { correct: 0, incorrect: 0, left: 0, score: 0 };
    });

    const totalQuestions = selectedPaper === '1' ? 100 : 80;
    const scoreMultiplier = selectedPaper === '1' ? 2 : 2.5;

    for (let q = 1; q <= totalQuestions; q++) {
        const userAnswerElement = document.querySelector(`input[name="q${q}"]:checked`);
        const userAnswer = userAnswerElement ? userAnswerElement.value : null;

        coachingInstitutes.forEach(coaching => {
            const keyRow = answerKeys.find(row =>
                row.Paper === selectedPaper &&
                row.Set === selectedSet &&
                row.Question === String(q)
            );

            if (keyRow) {
                const correctAnswer = keyRow[coaching]; // This will be 'A', 'B', 'C', 'D'
                if (correctAnswer === undefined || correctAnswer === '') {
                     // console.warn(`Answer key for Q${q} for ${coaching} is empty/undefined. Skipping.`);
                     // If an answer key is missing for a question/coaching, treat as left or handle as an error
                     results[coaching].left++; // Or decide how to handle missing keys
                     return;
                }

                if (userAnswer === null) {
                    results[coaching].left++;
                } else if (userAnswer === correctAnswer) {
                    results[coaching].correct++;
                } else {
                    results[coaching].incorrect++;
                }
            } else {
                // If the entire row for a question/set/paper is missing in CSV
                results[coaching].left++; // Treat as left
                // console.warn(`Answer key row for Paper ${selectedPaper}, Set ${selectedSet}, Question ${q} not found.`);
            }
        });
    }

    // Calculate final scores
    coachingInstitutes.forEach(coaching => {
        const { correct, incorrect } = results[coaching];
        // Ensure division by 3 is floating point
        results[coaching].score = (correct - (incorrect / 3.0)) * scoreMultiplier;
    });

    // Store results in sessionStorage to pass to the result page
    sessionStorage.setItem('scoreResults', JSON.stringify(results));
    sessionStorage.setItem('coachingNames', JSON.stringify(coachingInstitutes)); // Store names dynamically

    window.location.href = 'result.html';
}

// Function to display results on result.html
function displayResults() {
    const scoreResults = JSON.parse(sessionStorage.getItem('scoreResults'));
    const coachingNames = JSON.parse(sessionStorage.getItem('coachingNames'));

    if (!scoreResults || !coachingNames || coachingNames.length === 0) {
        alert('No results to display. Please calculate your score first.');
        window.location.href = 'index.html';
        return;
    }

    const tableHeadRow = document.querySelector('#resultTable thead tr');
    const tableBody = document.querySelector('#resultTable tbody');

    // Clear existing headers/body before populating
    tableHeadRow.innerHTML = '';
    tableBody.innerHTML = '';

    // Define categories to display (now these are columns)
    const categories = ['correct', 'incorrect', 'left', 'score'];
    const categoryLabels = {
        correct: 'Correct',
        incorrect: 'Incorrect',
        left: 'Left',
        score: 'Score'
    };

    // Build the table header (Categories are now columns)
    const emptyHeaderCell = document.createElement('th');
    tableHeadRow.appendChild(emptyHeaderCell); // Top-left empty cell
    categories.forEach(category => {
        const th = document.createElement('th');
        th.textContent = categoryLabels[category];
        tableHeadRow.appendChild(th);
    });

    // Build the table body (Coaching names are now rows)
    let positiveScoresSum = 0;
    let positiveScoresCount = 0;

    coachingNames.forEach(coaching => {
        const row = document.createElement('tr');
        const th = document.createElement('th'); // Coaching name is now a row header
        th.textContent = coaching.replace('Coaching', 'Inst. '); // Make names readable
        row.appendChild(th);

        categories.forEach(category => {
            const td = document.createElement('td');
            const value = scoreResults[coaching] ? scoreResults[coaching][category] : 'N/A';

            if (category === 'score') {
                td.textContent = (typeof value === 'number') ? value.toFixed(2) : value; // Format score
                // Add positive score to average calculation
                if (typeof value === 'number' && value > 0) {
                    positiveScoresSum += value;
                    positiveScoresCount++;
                }
            } else {
                td.textContent = (typeof value === 'number') ? value : value; // Display other stats as-is
            }
            row.appendChild(td);
        });
        tableBody.appendChild(row);
    });

    // Calculate Average Score
    const averageScore = positiveScoresCount > 0 ? (positiveScoresSum / positiveScoresCount) : 0;

    // Add the Average Score row
    const avgRow = document.createElement('tr');
    avgRow.classList.add('score-row'); // Use the existing highlight style for the average row

    const avgLabelCell = document.createElement('th');
    avgLabelCell.textContent = 'Average Score (Positive)';
    avgRow.appendChild(avgLabelCell);

    // Fill in empty cells for correct, incorrect, left (or 'N/A' if preferred)
    // and then the average score in the 'score' column
    categories.forEach(category => {
        const td = document.createElement('td');
        if (category === 'score') {
            td.textContent = averageScore.toFixed(2);
        } else {
            td.textContent = ''; // Or 'N/A' if you want placeholder for non-score columns
        }
        avgRow.appendChild(td);
    });
    tableBody.appendChild(avgRow);
}
const defaultTitle = 'Travel Budget';
const members = ['ARUL', 'Veer', 'Kandy'];
const defaultExpenses = [];
const STORAGE_KEY = 'split-calculator-state-v1';

const state = {
  title: defaultTitle,
  members: [...members],
  expenses: [...defaultExpenses]
};

let chartInstance = null;
let activeChartType = 'doughnut';

const tripTitleInput = document.getElementById('tripTitle');
const personNameInput = document.getElementById('personName');
const peopleList = document.getElementById('peopleList');
const expenseForm = document.getElementById('expenseForm');
const expenseTitleInput = document.getElementById('expenseTitle');
const expenseAmountInput = document.getElementById('expenseAmount');
const expensePayerSelect = document.getElementById('expensePayer');
const splitModeSelect = document.getElementById('splitMode');
const memberSplitList = document.getElementById('memberSplitList');
const personBreakdown = document.getElementById('personBreakdown');
const categoryBreakdown = document.getElementById('categoryBreakdown');
const totalSpendValue = document.getElementById('totalSpendValue');
const perPersonValue = document.getElementById('perPersonValue');
const expenseTableBody = document.getElementById('expenseTableBody');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const selectedSplitSummary = document.getElementById('selectedSplitSummary');
const selectAllMembersBtn = document.getElementById('selectAllMembers');
const clearSelectedMembersBtn = document.getElementById('clearSelectedMembers');
const chartTypeButtons = document.querySelectorAll('.chart-type-btn');

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value || 0);
}

function loadSavedState() {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (!savedState) {
      return null;
    }

    const parsed = JSON.parse(savedState);
    if (!parsed || !Array.isArray(parsed.members)) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      title: state.title,
      members: state.members,
      expenses: state.expenses
    }));
  } catch (error) {
    // Ignore storage quota / browser issues gracefully.
  }
}

function hydrateStateFromStorage() {
  const savedState = loadSavedState();

  if (!savedState) {
    state.title = defaultTitle;
    state.members = [...members];
    state.expenses = [...defaultExpenses];
    return;
  }

  state.title = savedState.title || defaultTitle;
  state.members = Array.isArray(savedState.members) && savedState.members.length > 0
    ? savedState.members
    : [...members];
  state.expenses = Array.isArray(savedState.expenses) ? savedState.expenses : [...defaultExpenses];
}

function updateTitle() {
  state.title = tripTitleInput.value.trim() || defaultTitle;
  document.title = `${state.title} - Split Calculator`;
  saveState();
}

function getSelectedMembers() {
  const selected = Array.from(memberSplitList.querySelectorAll('input:checked'))
    .map((checkbox) => checkbox.value);

  if (selected.length === 0) {
    return [...state.members];
  }

  return selected;
}

function updateSelectedSplitSummary() {
  const selected = Array.from(memberSplitList.querySelectorAll('input:checked')).map((input) => input.value);

  if (selected.length === 0) {
    selectedSplitSummary.textContent = 'Selected: none';
    return;
  }

  if (selected.length === state.members.length) {
    selectedSplitSummary.textContent = 'Selected: all members';
    return;
  }

  selectedSplitSummary.textContent = `Selected: ${selected.join(', ')}`;
}

function renderPeopleList() {
  peopleList.innerHTML = '';

  if (state.members.length === 0) {
    peopleList.innerHTML = '<div class="empty-state">No people added yet.</div>';
    return;
  }

  state.members.forEach((person) => {
    const chip = document.createElement('div');
    chip.className = 'person-chip';
    chip.innerHTML = `
      <span>${person}</span>
      <button class="remove-btn" type="button" data-name="${person}" aria-label="Remove ${person}">×</button>
    `;
    peopleList.appendChild(chip);
  });
}

function renderPayerOptions() {
  expensePayerSelect.innerHTML = state.members
    .map((person) => `<option value="${person}">${person}</option>`)
    .join('');

  if (state.members.length > 0) {
    expensePayerSelect.value = state.members[0];
  }
}

function renderSplitOptions() {
  memberSplitList.innerHTML = state.members
    .map((person) => `
      <label class="split-option">
        <input type="checkbox" value="${person}" checked />
        <span>${person}</span>
      </label>
    `)
    .join('');

  memberSplitList.querySelectorAll('input').forEach((checkbox) => {
    checkbox.addEventListener('change', updateSelectedSplitSummary);
  });

  updateSelectedSplitSummary();
}

function renderExpenseTable() {
  expenseTableBody.innerHTML = '';

  if (state.expenses.length === 0) {
    expenseTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No expenses have been added yet.</td></tr>';
    return;
  }

  state.expenses.forEach((expense) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="expense-tag">${expense.title}</span></td>
      <td>${formatCurrency(expense.amount)}</td>
      <td>${expense.payer}</td>
      <td>${expense.sharedWith.join(', ')}</td>
      <td>
        <button class="remove-btn" type="button" data-expense-id="${expense.id}" aria-label="Delete expense">×</button>
      </td>
    `;
    expenseTableBody.appendChild(row);
  });
}

function computeSummary() {
  const memberDetails = state.members.map((member) => {
    const paid = state.expenses
      .filter((expense) => expense.payer === member)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    const share = state.expenses.reduce((sum, expense) => {
      const splitMembers = expense.sharedWith.length > 0 ? expense.sharedWith : [...state.members];
      if (splitMembers.includes(member)) {
        return sum + (Number(expense.amount) / splitMembers.length);
      }
      return sum;
    }, 0);

    const balance = paid - share;

    return {
      name: member,
      paid,
      share,
      balance
    };
  });

  const categoryTotals = state.expenses.reduce((acc, expense) => {
    const key = expense.title.trim() || 'Expense';
    acc[key] = (acc[key] || 0) + Number(expense.amount);
    return acc;
  }, {});

  const totalSpend = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const perPersonValueTotal = state.members.length > 0 ? totalSpend / state.members.length : 0;

  totalSpendValue.textContent = formatCurrency(totalSpend);
  perPersonValue.textContent = formatCurrency(perPersonValueTotal);

  personBreakdown.innerHTML = memberDetails
    .map((person) => `
      <div class="person-row">
        <div class="person-name">${person.name}</div>
        <div class="person-meta">Paid ${formatCurrency(person.paid)}</div>
        <div class="person-meta">Share ${formatCurrency(person.share)}</div>
        <span class="amount-pill ${person.balance < 0 ? 'negative' : ''}">
          ${person.balance >= 0 ? 'Gets back' : 'Owes'} ${formatCurrency(Math.abs(person.balance))}
        </span>
      </div>
    `)
    .join('');

  personBreakdown.style.cssText = `
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 10px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    white-space: nowrap !important;
    align-items: stretch !important;
    height: 200px !important;
    max-height: 200px !important;
    min-height: 200px !important;
    padding: 6px 8px 8px !important;
  `;

  personBreakdown.querySelectorAll('.person-row').forEach((row) => {
    row.style.width = '260px';
    row.style.minWidth = '260px';
    row.style.height = '180px';
    row.style.flex = '0 0 260px';
    row.style.gridColumn = 'span 1';
  });

  categoryBreakdown.innerHTML = Object.entries(categoryTotals)
    .map(([category, amount], index) => `
      <div class="category-pill" style="background: linear-gradient(135deg, rgba(205, 180, 219, 0.18), rgba(189, 224, 254, 0.2)); border-left: 6px solid ${['#cdb4db', '#ffc8dd', '#bde0fe', '#a2d2ff', '#ffafcc', '#caffbf'][index % 6]};">
        <div>
          <strong>${category}</strong>
          <small>Category total</small>
        </div>
        <span>${formatCurrency(amount)}</span>
      </div>
    `)
    .join('');

  return { memberDetails, totalSpend };
}

function renderChart() {
  const { memberDetails } = computeSummary();

  const labels = memberDetails.map((item) => item.name);
  const paidValues = memberDetails.map((item) => item.paid);
  const palette = ['#8b5cf6', '#67b7ff', '#67d7b5', '#f7c97a', '#ff9fc9', '#b8b5ff'];

  const ctx = document.getElementById('spendChart');
  if (!ctx) {
    return;
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Paid by person',
        data: paidValues,
        backgroundColor: palette.slice(0, labels.length),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10,
        borderRadius: activeChartType === 'bar' ? 12 : 0,
        borderSkipped: false,
        tension: 0.28
      }
    ]
  };

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: activeChartType,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: {
          top: 12,
          bottom: 6,
          left: 8,
          right: 8
        }
      },
      cutout: activeChartType === 'doughnut' ? '58%' : 0,
      plugins: {
        legend: {
          position: activeChartType === 'doughnut' ? 'right' : 'bottom',
          labels: {
            color: '#334155',
            boxWidth: 12,
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              family: 'Inter',
              size: 12,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(24, 32, 45, 0.92)',
          titleColor: '#f8fafc',
          bodyColor: '#f8fafc',
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (context) => {
              const value = typeof context.parsed === 'object' ? context.parsed.y : context.parsed;
              return `${context.label}: ${formatCurrency(value)}`;
            }
          }
        }
      },
      scales: activeChartType === 'bar'
        ? {
            x: {
              grid: { display: false },
              ticks: { color: '#475569', font: { weight: '600' } },
              border: { display: false }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(148, 163, 184, 0.2)',
                drawBorder: false
              },
              ticks: {
                color: '#475569',
                padding: 8,
                callback: (value) => `₹${value}`
              },
              border: { display: false }
            }
          }
        : undefined
    }
  });
}

function renderAll() {
  tripTitleInput.value = state.title || defaultTitle;
  updateTitle();
  renderPeopleList();
  renderPayerOptions();
  renderSplitOptions();
  renderExpenseTable();
  renderChart();
  saveState();
}

function resetAllState() {
  state.title = defaultTitle;
  state.members = [...members];
  state.expenses = [...defaultExpenses];

  tripTitleInput.value = defaultTitle;
  personNameInput.value = '';
  expenseForm.reset();
  splitModeSelect.value = 'selected';
  selectedSplitSummary.textContent = 'Selected: all members';

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage removal errors.
  }

  renderAll();
}

function setChartType(type) {
  activeChartType = type;
  chartTypeButtons.forEach((button) => {
    const isActive = button.dataset.chartType === type;
    button.classList.toggle('active', isActive);
  });
  renderChart();
}

function addPerson() {
  const name = personNameInput.value.trim();

  if (!name) {
    personNameInput.focus();
    return;
  }

  if (state.members.some((member) => member.toLowerCase() === name.toLowerCase())) {
    personNameInput.value = '';
    personNameInput.focus();
    return;
  }

  state.members.push(name);
  personNameInput.value = '';
  renderAll();
}

function removePerson(name) {
  state.members = state.members.filter((member) => member !== name);

  state.expenses = state.expenses.map((expense) => ({
    ...expense,
    payer: expense.payer === name ? state.members[0] || '' : expense.payer,
    sharedWith: expense.sharedWith.filter((member) => member !== name)
  }));

  if (state.members.length === 0) {
    state.expenses = [];
  }

  renderAll();
}

function addExpense(event) {
  event.preventDefault();

  if (state.members.length === 0) {
    return;
  }

  const title = expenseTitleInput.value.trim();
  const amount = Number(expenseAmountInput.value);
  const payer = expensePayerSelect.value;

  if (!title || Number.isNaN(amount) || amount <= 0) {
    return;
  }

  const splitMode = splitModeSelect.value;
  const sharedWith = splitMode === 'all'
    ? [...state.members]
    : getSelectedMembers();

  const newExpense = {
    id: Date.now(),
    title,
    amount,
    payer,
    sharedWith: sharedWith.length > 0 ? sharedWith : [...state.members]
  };

  state.expenses.push(newExpense);
  expenseForm.reset();
  splitModeSelect.value = 'selected';
  renderAll();
}

function removeExpense(id) {
  state.expenses = state.expenses.filter((expense) => expense.id !== Number(id));
  renderAll();
}

function exportToExcel() {
  const workbook = XLSX.utils.book_new();

  const summaryRows = state.members.map((member) => {
    const paid = state.expenses
      .filter((expense) => expense.payer === member)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    const share = state.expenses.reduce((sum, expense) => {
      const splitMembers = expense.sharedWith.length > 0 ? expense.sharedWith : [...state.members];
      return splitMembers.includes(member) ? sum + (Number(expense.amount) / splitMembers.length) : sum;
    }, 0);

    return {
      Person: member,
      'Total Paid': paid,
      'Total Share': share,
      Balance: paid - share
    };
  });

  const expenseRows = state.expenses.map((expense) => ({
    Expense: expense.title,
    Amount: expense.amount,
    'Paid By': expense.payer,
    'Split With': expense.sharedWith.join(', ')
  }));

  const categoryRows = Object.entries(state.expenses.reduce((acc, expense) => {
    const key = expense.title.trim() || 'Expense';
    acc[key] = (acc[key] || 0) + Number(expense.amount);
    return acc;
  }, {})).map(([category, amount]) => ({ Category: category, Amount: amount }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const expenseSheet = XLSX.utils.json_to_sheet(expenseRows);
  const chartDataSheet = XLSX.utils.json_to_sheet(categoryRows);

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Expenses');
  XLSX.utils.book_append_sheet(workbook, chartDataSheet, 'Chart Data');

  XLSX.writeFile(workbook, `${(state.title || 'split-calculator').replace(/\s+/g, '_')}.xlsx`);
}

tripTitleInput.addEventListener('input', updateTitle);
document.getElementById('addPersonBtn').addEventListener('click', addPerson);
resetAllBtn.addEventListener('click', resetAllState);
chartTypeButtons.forEach((button) => {
  button.addEventListener('click', () => setChartType(button.dataset.chartType));
});
selectAllMembersBtn.addEventListener('click', () => {
  memberSplitList.querySelectorAll('input').forEach((checkbox) => {
    checkbox.checked = true;
  });
  updateSelectedSplitSummary();
});
clearSelectedMembersBtn.addEventListener('click', () => {
  memberSplitList.querySelectorAll('input').forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateSelectedSplitSummary();
});
personNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addPerson();
  }
});

peopleList.addEventListener('click', (event) => {
  const target = event.target.closest('.remove-btn');
  if (!target) return;

  const name = target.dataset.name;
  removePerson(name);
});

expenseTableBody.addEventListener('click', (event) => {
  const target = event.target.closest('.remove-btn');
  if (!target) return;

  const expenseId = target.dataset.expenseId;
  removeExpense(expenseId);
});

expenseForm.addEventListener('submit', addExpense);
downloadExcelBtn.addEventListener('click', exportToExcel);

hydrateStateFromStorage();
renderAll();

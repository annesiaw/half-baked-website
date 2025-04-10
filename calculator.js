document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('result');
    const buttons = document.querySelectorAll('button');
    let currentInput = '';
    let previousInput = '';
    let operation = null;
    let shouldResetDisplay = false;

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const value = button.getAttribute('data-value');

            if (value >= '0' && value <= '9' || value === '.') {
                if (shouldResetDisplay) {
                    currentInput = value;
                    shouldResetDisplay = false;
                } else {
                    currentInput += value;
                }
                display.value = currentInput;
            } else if (['+', '-', '×', '÷', '%'].includes(value)) {
                if (currentInput !== '') {
                    if (previousInput !== '') {
                        calculate();
                    }
                    previousInput = currentInput;
                    currentInput = '';
                    operation = value;
                }
            } else if (value === '=') {
                if (previousInput !== '' && currentInput !== '') {
                    calculate();
                    previousInput = '';
                    operation = null;
                }
            } else if (value === 'C') {
                currentInput = '';
                previousInput = '';
                operation = null;
                display.value = '0';
            } else if (value === '±') {
                if (currentInput !== '') {
                    currentInput = (parseFloat(currentInput) * -1).toString();
                    display.value = currentInput;
                }
            }
        });
    });

    function calculate() {
        let result;
        const prev = parseFloat(previousInput);
        const current = parseFloat(currentInput);

        switch (operation) {
            case '+':
                result = prev + current;
                break;
            case '-':
                result = prev - current;
                break;
            case '×':
                result = prev * current;
                break;
            case '÷':
                result = prev / current;
                break;
            case '%':
                result = prev % current;
                break;
        }

        currentInput = result.toString();
        display.value = currentInput;
        shouldResetDisplay = true;
    }
}); 
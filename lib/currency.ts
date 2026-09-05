/**
 * Utility functions for PKR (Pakistani Rupee) formatting and handling.
 */

export function formatPKR(amount: number, showPrefix: boolean = true): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(safeAmount);

  return showPrefix ? `Rs. ${formatted}` : formatted;
}

export function parsePKR(value: string): number {
  if (!value) return 0;
  const cleanStr = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}

export function numberToWordsPKR(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only';
  
  const safeAmount = Math.floor(Math.abs(amount));
  
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertGroup(num: number): string {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      str += units[num] + ' ';
    }
    return str;
  }

  let words = '';
  let temp = safeAmount;

  if (temp >= 10000000) {
    words += convertGroup(Math.floor(temp / 10000000)) + 'Crore ';
    temp %= 10000000;
  }
  if (temp >= 100000) {
    words += convertGroup(Math.floor(temp / 100000)) + 'Lakh ';
    temp %= 100000;
  }
  if (temp >= 1000) {
    words += convertGroup(Math.floor(temp / 1000)) + 'Thousand ';
    temp %= 1000;
  }
  if (temp > 0) {
    words += convertGroup(temp);
  }

  return `${words.trim()} Rupees Only`;
}

const sanitizePhoneNumber = (phoneNumber) => {
  if (phoneNumber.startsWith("+")) {
    return phoneNumber.substring(1); // Remove the '+' character
  }
  return phoneNumber; // If no '+' character, return the original phone number
};

const extractNumberFromClient = (clientNumber) => {
  if (clientNumber.startsWith("client:")) {
    return clientNumber.slice("client:".length);
  }
  return clientNumber;
};

module.exports = { sanitizePhoneNumber, extractNumberFromClient };

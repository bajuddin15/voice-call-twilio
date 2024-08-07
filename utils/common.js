const moment = require("moment");

const sanitizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return "";
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

const formatAverageCallsDuration = (seconds) => {
  const duration = moment.duration(seconds, "seconds");
  const hours = duration.hours();
  const minutes = duration.minutes();
  const secs = duration.seconds();
  let formattedDuration = "";
  if (hours > 0) formattedDuration += `${hours}h `;
  if (minutes > 0) formattedDuration += `${minutes}m `;
  if (secs > 0) formattedDuration += `${secs}s`;
  return formattedDuration.trim() || "0s";
};

const addPlusInNumber = (phoneNumber) => {
  if (!phoneNumber) return "";
  if (phoneNumber.startsWith("+")) {
    return phoneNumber;
  }

  return `+${phoneNumber}`;
};

module.exports = {
  sanitizePhoneNumber,
  extractNumberFromClient,
  formatAverageCallsDuration,
  addPlusInNumber,
};

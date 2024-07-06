const CallForwarding = require("../models/callForwarding.models");
const MissedCallAction = require("../models/missedCallAction.models");
const TwilioConfig = require("../models/twilioConfig.models");

// POST -
const setupCallForwarding = async (req, res) => {
  const token = req.token;
  const { isEnabled, forwardedNumber, toPhoneNumber } = req.body;
  try {
    const callForward = await CallForwarding.findOne({
      crmToken: token,
      forwardedNumber,
    });

    if (callForward) {
      // call forwarding setting already exist
      callForward.isEnabled = isEnabled;
      callForward.toPhoneNumber = toPhoneNumber;
      await callForward.save();

      return res.status(200).json({
        success: true,
        message: "Call forwarding setuped",
        data: callForward,
      });
    } else {
      // create new call forwarding config
      const newCallForward = new CallForwarding({
        crmToken: token,
        isEnabled,
        forwardedNumber,
        toPhoneNumber,
      });
      let twilioConfig = await TwilioConfig.findOne({
        crmToken: token,
      });
      if (twilioConfig) {
        twilioConfig.callForwarding.push(newCallForward._id);
      } else {
        // create new twilioConfig
        twilioConfig = new TwilioConfig({
          crmToken: token,
        });
        twilioConfig.callForwarding.push(newCallForward._id);
      }
      await Promise.all([newCallForward.save(), twilioConfig.save()]);
      return res.status(201).json({
        success: true,
        message: "Call forwarding setuped",
        data: newCallForward,
      });
    }
  } catch (error) {
    console.log("Error in setup call forwarding", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};

const setupMissedCallAction = async (req, res) => {
  const token = req.token;
  const { actionType, applyNumber, fromNumber, message, templateName } =
    req.body;
  try {
    const action = await MissedCallAction.findOne({
      crmToken: token,
      applyNumber,
    });

    if (action) {
      // action is already exist so update this
      action.actionType = actionType || action.actionType;
      action.fromNumber = fromNumber || action.fromNumber;
      action.message = message || action.message;
      action.templateName = templateName || action.templateName;
      await action.save();

      return res.status(200).json({
        success: true,
        message: "MissedCallAction updated",
        data: action,
      });
    } else {
      // create new action
      const newAction = new MissedCallAction({
        crmToken: token,
        actionType,
        applyNumber,
        fromNumber,
        message,
        templateName,
      });
      let twilioConfig = await TwilioConfig.findOne({
        crmToken: token,
      });
      if (twilioConfig) {
        twilioConfig.missedCallAction.push(newAction._id);
      } else {
        // create new twilioConfig
        twilioConfig = new TwilioConfig({
          crmToken: token,
        });
        twilioConfig.missedCallAction.push(newAction._id);
      }
      await Promise.all([newAction.save(), twilioConfig.save()]);

      return res.status(201).json({
        success: true,
        message: "MissedCallAction created",
        data: newAction,
      });
    }
  } catch (error) {
    console.log("Error in setupMissedCallAction", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};

const editCallForwarding = async (req, res) => {
  const token = req.token;
  const { id } = req.params;
  const { isEnabled, toPhoneNumber } = req.body;
  try {
    const callForward = await CallForwarding.findById(id);
    if (!callForward || callForward.crmToken !== token) {
      return res.status(404).json({
        success: false,
        message: "Call forwarding not found",
      });
    }

    callForward.isEnabled = isEnabled;
    callForward.toPhoneNumber = toPhoneNumber;
    await callForward.save();

    res.status(200).json({
      success: true,
      message: "Call forwarding updated",
      data: callForward,
    });
  } catch (error) {
    console.log("Error in call forwarding update: ", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};
const editMissedCallAction = async (req, res) => {
  const token = req.token;
  const { id } = req.params;
  const { actionType, fromNumber, message, templateName } = req.body;
  try {
    const action = await MissedCallAction.findById(id);
    if (!action || action.crmToken !== token) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    action.actionType = actionType || action.actionType;
    action.fromNumber = fromNumber || action.fromNumber;
    action.message = message || action.message;
    action.templateName = templateName || action.templateName;
    await action.save();

    res.status(200).json({
      success: true,
      message: "Action updated",
      data: action,
    });
  } catch (error) {
    console.log("Error in Missed Call action update: ", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};

const getCallForwarding = async (req, res) => {
  const token = req.token;
  const { forwardedNumber } = req.body;
  try {
    const callForward = await CallForwarding.findOne({
      crmToken: token,
      forwardedNumber,
    });
    if (!callForward) {
      return res.status(404).json({
        success: false,
        message: "Call forwarding not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Call forwarding found",
      data: callForward,
    });
  } catch (error) {
    console.log("Error in getCallForwarding: ", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};
const getMissedCallAction = async (req, res) => {
  const token = req.token;
  const { applyNumber } = req.body;
  try {
    const action = await MissedCallAction.findOne({
      crmToken: token,
      applyNumber,
    });
    if (!action) {
      return res.status(404).json({
        success: false,
        message: "action not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Found",
      data: action,
    });
  } catch (error) {
    console.log("Error in getMissedCallAction: ", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};

const deleteCallForwarding = async (req, res) => {
  const token = req.token;
  const { id } = req.params;
  try {
    const callForward = await CallForwarding.findById(id);
    if (!callForward || callForward.crmToken !== token) {
      return res.status(404).json({
        success: false,
        message: "Call forwarding not found",
      });
    }

    // Use the $pull operator to remove the id from the callForwarding array
    const twilioConfigUpdate = await TwilioConfig.updateOne(
      { crmToken: token },
      { $pull: { callForwarding: id } }
    );

    if (twilioConfigUpdate.nModified === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Twilio configuration not found or call forwarding not found in config",
      });
    }

    // Delete the CallForwarding document
    await CallForwarding.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Call forwarding deleted",
    });
  } catch (error) {
    console.log("Error in deleteCallForwarding: ", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};
const deleteMissedCallAction = async (req, res) => {
  const token = req.token;
  const { id } = req.params;
  try {
    const action = await MissedCallAction.findById(id);
    if (!action || action.crmToken !== token) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    // Use the $pull operator to remove the id from the missedCallAction array
    const twilioConfigUpdate = await TwilioConfig.updateOne(
      { crmToken: token },
      { $pull: { missedCallAction: id } }
    );

    if (twilioConfigUpdate.nModified === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Twilio configuration not found or missed call action not found in config",
      });
    }

    // Delete the MissedCallAction document
    await MissedCallAction.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Missed call action deleted",
    });
  } catch (error) {
    console.log("Error in deleteMissedCallAction: ", error?.message);
    res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};

module.exports = {
  setupCallForwarding,
  setupMissedCallAction,
  editCallForwarding,
  editMissedCallAction,
  getCallForwarding,
  getMissedCallAction,
  deleteCallForwarding,
  deleteMissedCallAction,
};

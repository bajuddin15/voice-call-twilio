const dotenv = require("dotenv");
dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN = process.env.YOUR_DOMAIN;

const createOrGetCustomer = async (email) => {
  const customers = await stripe.customers.list({
    email: email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0];
  } else {
    return await stripe.customers.create({
      email: email,
    });
  }
};

const createProductAndPrice = async (number, price, flagUrl) => {
  const product = await stripe.products.create({
    name: number,
    images: [flagUrl],
  });

  const priceObj = await stripe.prices.create({
    unit_amount: Math.round(price * 100),
    currency: "usd",
    recurring: {
      interval: "month",
    },
    product: product.id,
  });

  return priceObj.id;
};

const createSubscriptionSession = async (req, res) => {
  const { numbers, email, phoneNumber } = req.body;
  const token = req.token;

  try {
    const customer = await createOrGetCustomer(email);

    const lineItemsPromises = numbers.map(async (item) => {
      const priceId = await createProductAndPrice(
        item.number,
        item.price,
        item.flagUrl
      );
      return {
        price: priceId,
        quantity: 1,
      };
    });

    const lineItems = await Promise.all(lineItemsPromises);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "subscription",
      success_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/cancel`,
      customer: customer.id,
      metadata: {
        phoneNumber: phoneNumber,
        token: token,
        numbers: numbers.map((item) => item.number).join(", "),
      },
    });

    res.send({ id: session.id });
  } catch (error) {
    console.error("Error creating subscription session:", error.message);
    res.status(500).send({ error: error.message });
  }
};

const sessionStatus = async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(
      req.query.session_id
    );

    res.send({
      status: session.payment_status,
      customer_email: session.customer_email || session.customer_details.email,
      phoneNumber: session.metadata.phoneNumber,
      token: session.metadata.token,
      pricePaid: session.metadata.pricePaid,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// const createCheckoutSession = async (req, res) => {
//   const { numbers, email, phoneNumber } = req.body;
//   const token = req.token;

//   // Calculate the total price
//   const totalPrice = numbers.reduce((acc, item) => acc + item.price, 0);

//   const lineItems = numbers.map((item) => ({
//     price_data: {
//       currency: "usd",
//       product_data: {
//         name: item.number,
//         images: [item.flagUrl],
//       },
//       unit_amount: Math.round(item.price * 100),
//     },
//     quantity: 1,
//   }));

//   try {
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       line_items: lineItems,
//       mode: "payment",
//       success_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${YOUR_DOMAIN}/cancel`,
//       customer_email: email, // Ensure the customer email is passed here
//       metadata: {
//         phoneNumber: phoneNumber,
//         token: token,
//         pricePaid: totalPrice, // Set the total price here
//       },
//     });

//     res.send({ id: session.id });
//   } catch (error) {
//     console.error("Error creating checkout session:", error.message);
//     res.status(500).send({ error: error.message });
//   }
// };

// const sessionStatus = async (req, res) => {
//   try {
//     const session = await stripe.checkout.sessions.retrieve(
//       req.query.session_id
//     );

//     res.send({
//       status: session.payment_status,
//       customer_email: session.customer_email || session.customer_details.email,
//       phoneNumber: session.metadata.phoneNumber,
//       token: session.metadata.token,
//       pricePaid: session.metadata.pricePaid,
//     });
//   } catch (error) {
//     res.status(500).send({ error: error.message });
//   }
// };

module.exports = {
  // createCheckoutSession,
  // sessionStatus,
  createSubscriptionSession,
  sessionStatus,
};

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = 5000;
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

// jwt verify middle ware

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: 'unauthoraized access' });
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.JWT_AC_TOKEN, (error, decode) => {
    if (error) {
      return res.status.send({ error: true, message: 'unauthorized access' });
    }
    req.decode = decode;
  });
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mrvtr8q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// jwt api
app.post('/jwt', (req, res) => {
  const email = req.body;
  const token = jwt.sign(email, process.env.JWT_AC_TOKEN, { expiresIn: '5h' });
  res.send({ token });
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // all collection here
    const classCollection = client.db('languageLoom').collection('classes');
    const instructorCollection = client
      .db('languageLoom')
      .collection('instructors');
    const userCollection = client.db('languageLoom').collection('users');
    const selectClassCollection = client
      .db('languageLoom')
      .collection('selectedClasses');
    const enrolledClassCollection = client
      .db('languageLoom')
      .collection('enrolledClass');
    const paymentCollection = client.db('languageLoom').collection('payments');

    // post user to mongodb all users api here
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;

      const user = req.body;

      const filter = { email: email };
      const options = { upsert: true };
      const userDoc = {
        $set: {
          ...user,
        },
      };
      const result = await userCollection.updateOne(filter, userDoc, options);
      res.send(result);
    });

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      if (email) {
        const query = { email: email };
        const result = await userCollection.findOne(query);
        res.send(result);
      }
    });

    app.patch('/users/:email', async (req, res) => {
      const email = req.params.email;

      // update this as admin or instructor
      if (email) {
        const filter = { email: email };
        const { role } = req.body;
        const updatedUser = {
          $set: {
            role: role,
          },
        };
        const result = await userCollection.updateOne(filter, updatedUser);
        res.send(result);
      }
    });

    // check admin or instractor apis
    app.get('/users', async (req, res) => {
      const email = req.query.email;

      if (email) {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        const isInstructor = user?.role === 'instructor';
        res.send({ isAdmin, isInstructor });
        return;
      } else {
        const result = await userCollection.find().toArray();
        res.send(result);
      }
    });

    //  get the all classes data
    app.get('/classes', async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { email: email };
      }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/classes/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await selectClassCollection.findOne(query);
      res.send(result);
    });

    // patch the single class available seats
    app.patch('/classes/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const { status, feedback, seats, inrolled } = req.body;
      const filter = { _id: new ObjectId(id) };

      //  update the status
      if (status) {
        const updateStatus = {
          $set: {
            status: status,
          },
        };
        const result = await classCollection.updateOne(filter, updateStatus);
        return res.send(result);
      }

      // update the feedback
      if (feedback) {
        const updateFeedback = {
          $set: {
            feedback: feedback,
          },
        };
        const result = await classCollection.updateOne(filter, updateFeedback);
        return res.send(result);
      }

      // update the available seats
      if (seats) {
        console.log(seats, inrolled);
        const updatedSeats = {
          $set: {
            availableSeats: seats,
          },
        };
        const result = await classCollection.updateOne(filter, updatedSeats);
        return res.send(result);
      }
      // update the inrolled student
      if (inrolled) {
        const updateInrolledStudent = {
          $set: {
            inrolledStudent: inrolled,
          },
        };

        const result = await classCollection.updateOne(
          filter,
          updateInrolledStudent
        );
        return res.send(result);
      }
    });

    // update the class feedback
    app.patch('/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateFeedback = {
        $set: {
          feedback: feedback,
        },
      };
      const result = await classCollection.updateOne(
        filter,
        updateFeedback,
        options
      );
      return res.send(result);
    });

    // update the hole class
    app.put('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const classInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          ...classInfo,
        },
      };
      const result = await classCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send(result);
    });

    // delete the denied class
    app.delete('/classes/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    app.post('/classes', async (req, res) => {
      const classData = req.body;
      const result = await classCollection.insertOne(classData);
      res.send(result);
    });

    // get the all instructor data from db
    app.get('/instructors', async (req, res) => {
      const allUser = await userCollection.find().toArray();
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    // selected class api here
    app.post('/selectedClasses', verifyJWT, async (req, res) => {
      const classes = req.body;
      const result = await selectClassCollection.insertOne(classes);
      res.send(result);
    });

    app.get('/selectedClasses/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await selectClassCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/selectedClasses/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectClassCollection.deleteOne(query);
      res.send(result);
    });

    // enrolled classes apis here
    app.post('/enrolled-class', verifyJWT, async (req, res) => {
      const enClass = req.body;
      const result = await enrolledClassCollection.insertOne(enClass);
      res.send(result);
    });

    app.get('/enrolled-class/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await enrolledClassCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/enrolled-class/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await enrolledClassCollection.deleteOne(query);
      res.send(result);
    });

    //  payment history api

    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    app.get('/payments/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // payment intent create
    app.post('/payment-intent', async (req, res) => {
      const { price } = req.body;
      if (price) {
        const amount = parseFloat(price) * 100;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('langauge data is comming');
});

app.listen(port, () => {
  console.log('server is running on port', port);
});

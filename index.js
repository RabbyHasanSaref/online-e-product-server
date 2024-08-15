const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
// const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://shopease-37409.web.app",
    "https://shopease-37409.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nrdgddr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db(`${process.env.DB_USER}`);
    const userCollection = db.collection("users");
    const productCollection = db.collection("products");

    // get product amount
    app.get("/count", async (req, res) => {
      const count = await productCollection.estimatedDocumentCount();
      res.send({ amount: count });
    });

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.post("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    app.put("/register", async (req, res) => {
      const user = req.body;
      const isExist = await userCollection.findOne({
        userEmail: user?.userEmail,
      });
      if (isExist) return res.send("Already Exist");
      const updateDoc = {
        $set: {
          ...user,
        },
      };
      const filter = { userEmail: user?.userEmail };
      const options = { upsert: true };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    //get products count
    app.get("/getCount", async (req, res) => {
      const category = req.query.category;
      const brand = req.query.brand;
      const search = req.query.search || "";
      let priceRange = req.query.priceRange;
      if (priceRange) {
        priceRange = priceRange.split(",").map(Number);
      }
      let query = {
        productName: { $regex: search, $options: "i" },
      };
      if (category) query.category = category;
      if (brand) query.brandName = brand;
      // Apply price range filter
      if (priceRange && priceRange.length === 2) {
        query.price = { $gte: priceRange[0], $lte: priceRange[1] };
      }
      const count = await productCollection.countDocuments(query);
      res.send({ count });
    });

    //get filtered products for filtering and pagination
    app.get("/products", async (req, res) => {
      const page = parseFloat(req.query.page);
      const size = parseFloat(req.query.size);
      const category = req.query.category;
      const brand = req.query.brand;
      const sortByPrice = req.query.sortByPrice;
      const sortByDate = req.query.sortByDate;
      const search = req.query.search || "";

      let priceRange = req.query.priceRange;
      if (priceRange) {
        priceRange = priceRange.split(",").map(Number);
      }

      let query = {
        productName: { $regex: search, $options: "i" },
      };

      if (category) query.category = category;
      if (brand) query.brandName = brand;

      // Apply price range filter
      if (priceRange && priceRange.length === 2) {
        query.price = { $gte: priceRange[0], $lte: priceRange[1] };
      }

      let options = {};
      if (sortByPrice)
        options = {
          ...options.sort,
          sort: { price: sortByPrice === "L2H" ? 1 : -1 },
        };
      if (sortByDate)
        options = {
          ...options.sort,
          sort: {
            creationDate: sortByDate === "new" ? -1 : 1,
          },
        };
      const result = await productCollection
        .find(query, options)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from ShopEase Server..");
});

app.listen(port, () => {
  console.log(`ShopEase is running on port ${port}`);
});

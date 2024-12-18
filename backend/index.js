const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 8083;

// Middleware
app.use(
  cors({
    origin: ["https://explorepricing.com","https://www.clothinbittinc.com/","https://www.clothinbittinc.com"], // Add your client domain here
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// MongoDB connection and reuse logic
let isConnected = false;
const connectToDatabase = async () => {
  if (isConnected) return;
  try {
    const connection = await mongoose.connect(
      "mongodb+srv://admin:sunriseeast1234RAS@royoapi.3qmdrjq.mongodb.net/xup?retryWrites=true&w=majority&appName=RoyoApi",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    isConnected = !!connection.connections[0].readyState;
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1); // Exit if database connection fails
  }
};

// Route to upload Excel file and dynamically create a collection
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    await connectToDatabase();

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (sheetData.length === 0) {
      return res.status(400).send({ message: "Uploaded file contains no data." });
    }

    // Create a unique collection name
    const timestamp = Date.now();
    const modelName = `${sheetName.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

    const DynamicModel = mongoose.models[modelName]
      ? mongoose.models[modelName]
      : mongoose.model(modelName, new mongoose.Schema({}, { strict: false }));

    // Save data to the collection
    await DynamicModel.insertMany(sheetData);
    fs.unlinkSync(filePath); // Remove the uploaded file

    res.status(200).send({
      message: "File uploaded and data saved successfully.",
      collection: modelName,
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    res.status(500).send({ message: "Error processing file." });
  }
});

// Route to fetch all collections and their data
// Route to fetch all collections and their data
app.get("/data", async (req, res) => {
  try {
    await connectToDatabase();

    // List all collections from the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.length === 0) {
      return res.status(404).send({ message: "No data found in the database." });
    }

    const allData = {};

    // Fetch documents for each collection
    for (const collection of collections) {
      const collectionName = collection.name;

      // Dynamically load models without caching issues
      let Model;
      if (mongoose.models[collectionName]) {
        Model = mongoose.models[collectionName];
      } else {
        Model = mongoose.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
      }

      allData[collectionName] = await Model.find({});
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send({ message: "Error fetching data." });
  }
});


// Route to update a specific document in a collection
app.put("/data/:collection/:id", async (req, res) => {
  try {
    await connectToDatabase();

    const { collection, id } = req.params;
    const Model = mongoose.models[collection] || mongoose.model(collection, new mongoose.Schema({}, { strict: false }));

    const updatedDocument = await Model.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedDocument) {
      return res.status(404).send({ message: "Document not found." });
    }

    res.status(200).send({ message: "Data updated successfully.", updatedDocument });
  } catch (error) {
    console.error("Error updating data:", error);
    res.status(500).send({ message: "Error updating data." });
  }
});

// Route to delete a specific document in a collection
app.delete("/data/:collection/:id", async (req, res) => {
  try {
    await connectToDatabase();

    const { collection, id } = req.params;
    const Model = mongoose.models[collection] || mongoose.model(collection, new mongoose.Schema({}, { strict: false }));

    const deletedDocument = await Model.findByIdAndDelete(id);
    if (!deletedDocument) {
      return res.status(404).send({ message: "Document not found." });
    }

    res.status(200).send({ message: "Data deleted successfully." });
  } catch (error) {
    console.error("Error deleting data:", error);
    res.status(500).send({ message: "Error deleting data." });
  }
});

// Route to delete an entire collection
app.delete("/collection/:collection", async (req, res) => {
  try {
    await connectToDatabase();

    const { collection } = req.params;
    await mongoose.connection.db.dropCollection(collection);

    res.status(200).send({ message: `Collection '${collection}' deleted successfully.` });
  } catch (error) {
    console.error("Error deleting collection:", error);
    res.status(500).send({ message: "Error deleting collection." });
  }
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await connectToDatabase(); // Ensure the database is connected when the server starts
});

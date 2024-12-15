const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const cors = require("cors");
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(
  cors({
    origin: "*", // Allow requests from any origin
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow these HTTP methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow these headers
  })
);
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.mongo_url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Multer configuration for file uploads
const upload = multer({ dest: "uploads/" });

// Route to upload Excel file and dynamically create a collection
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
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

    // Dynamically create or reuse a Mongoose model for the collection
    const DynamicModel = mongoose.models[modelName]
      ? mongoose.models[modelName]
      : mongoose.model(modelName, new mongoose.Schema({}, { strict: false }));

    // Save data to the collection
    await DynamicModel.insertMany(sheetData);
    fs.unlinkSync(filePath); // Remove the uploaded file

    res.status(200).send({ message: "File uploaded and data saved successfully.", collection: modelName });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error processing file." });
  }
});

// Route to fetch all collections and their data
app.get("/data", async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.length === 0) {
      return res.status(404).send({ message: "No data found in the database." });
    }

    const allData = {};
    for (const collection of collections) {
      const modelName = collection.name;
      const Model = mongoose.models[modelName] || mongoose.model(modelName, new mongoose.Schema({}, { strict: false }));
      allData[modelName] = await Model.find({});
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error fetching data." });
  }
});

// Route to update a specific document in a collection
app.put("/data/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;

    // Dynamically access the correct model
    const Model = mongoose.models[collection] || mongoose.model(collection, new mongoose.Schema({}, { strict: false }));

    const updatedDocument = await Model.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedDocument) {
      return res.status(404).send({ message: "Document not found." });
    }

    res.status(200).send({ message: "Data updated successfully.", updatedDocument });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error updating data." });
  }
});

// Route to delete a specific document in a collection
app.delete("/data/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;

    // Dynamically access the correct model
    const Model = mongoose.models[collection] || mongoose.model(collection, new mongoose.Schema({}, { strict: false }));

    const deletedDocument = await Model.findByIdAndDelete(id);
    if (!deletedDocument) {
      return res.status(404).send({ message: "Document not found." });
    }

    res.status(200).send({ message: "Data deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error deleting data." });
  }
});

// Route to delete an entire collection
app.delete("/collection/:collection", async (req, res) => {
  try {
    const { collection } = req.params;

    // Drop the collection from MongoDB
    await mongoose.connection.db.dropCollection(collection);

    res.status(200).send({ message: `Collection '${collection}' deleted successfully.` });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error deleting collection." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
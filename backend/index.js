const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const cors = require("cors");
require('dotenv').config();

const app = express();



app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"], 
    allowedHeaders: ["Content-Type", "Authorization"], 
  })
);
app.use(express.json());





const upload = multer({ dest: "uploads/" });


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

mongoose.connect('mongodb+srv://admin:sunriseeast1234RAS@royoapi.3qmdrjq.mongodb.net/xup?retryWrites=true&w=majority&appName=RoyoApi').then(()=>{
  app.listen(8080, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
  
});


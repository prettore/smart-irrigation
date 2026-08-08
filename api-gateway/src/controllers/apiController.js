import express from "express";
const router = express.Router();
import readServices from "../services/readServices.js";
import evapotranspirationServices from "../services/evapotranspirationServices.js";

router.post("/soil", async (req, res) => {
  const result = await readServices.storeSensorInfos(req.body);
  res.status(200).send(result);
});
router.post("/air", async (req, res) => {
  const result = await readServices.storeSensorInfos(req.body);
  res.status(200).json(result);
});
router.post("/sample", async (req, res) => {
  console.log("ESP32 online....");
  console.log(req.body);
  res.status(200).json(true);
});

router.get("/", async (req, res) => {
  const { bedId } = req.query;
  const response = await readServices.getReadInfos(bedId);
  res.json(response);
});

router.post("/teach", async (req, res) => {
  const { bedId } = req.body;
  const response = await readServices.teachIrrigationToIA(bedId);
  res.json(response);
});
router.post("/train", async (req, res) => {
  const { WC, plantingBedId, ETc, air_temperature, air_humidity, isFirst,isLast, stage } = req.body;
  const response = await evapotranspirationServices.verifyIrrigationTraining(
    WC, plantingBedId, ETc, air_temperature, air_humidity, isFirst, isLast, stage
  );
  return res.status(200).json(response);
});
router.post("/penmann", async (req, res) => {
  const { WC, plantingBedId, ETc } = req.body;
  const response = await evapotranspirationServices.verifyIrrigationPenmann(
    WC, plantingBedId, ETc);
  return res.status(200).json(response);
});
router.post("/reward", async (req, res) => {
  const { 
    WC, 
    index, 
    plantingBedId, 
    air_temperature, 
    air_humidity, 
    stage, 
    volume_applied,
    moisture_before,       
    volume_applied_before 
  } = req.body;

  const response = await evapotranspirationServices.calculateReward(
    WC, 
    index, 
    plantingBedId, 
    air_temperature, 
    air_humidity, 
    stage, 
    volume_applied,
    moisture_before,       
    // volume_applied_before   
  );
  return res.status(200).json(response);
});


export default router;

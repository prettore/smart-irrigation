import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export default function auth(req, res, next) {
  try{
    let plantingBedId;

     if (req.method === "POST") {
      plantingBedId = req.body.plantingBedId;
    } else if (req.method === "GET") {
      plantingBedId = req.query.bedId
    }
    const plantingBed = prisma.plantingBed.findUnique({
      where: { id: plantingBedId },
    });

    if (!plantingBedId || !isUUID(plantingBedId || plantingBed === null)) {
      return res.status(401).json({ error: "Acesso negado" });
    }
    
    next();
  }catch(err){
    return res.status(501).json({ error: "Erro interno" });
  }
};


function isUUID(str) {
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(str);
}

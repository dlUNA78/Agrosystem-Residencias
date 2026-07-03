import db from "../../models/index.js";
const { Crop } = db;

export const renderCropsPublic = async (req, res) => {
  res.render('public/crops', {
    pageTitle:  'Cultivos',
    activePage: 'crops',
  });
};

export const renderCropDetail = async (req, res) => {
  res.render('public/crop-detail', {
    pageTitle:  'Detalle Cultivo',
    activePage: 'crops',
  });
};
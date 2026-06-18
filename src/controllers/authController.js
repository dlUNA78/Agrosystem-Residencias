import bcrypt from 'bcrypt';
import db from '../models/index.js';

const { User } = db;

export const authController = {
// Se renderiza la vitsa
  
  showRegister: (req, res) => {
    // Si el usuario ya esta logeado, va directo al dash
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/');
    }
    res.render('auth/register', { title: 'Registrarse en INIFAP' });
  },

  showLogin: (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/');
    }
    res.render('auth/login', { title: 'Iniciar Sesión' });
  },

  //Logica de Negocio

  register: async (req, res) => {
    try {
      const { full_name, email, password } = req.body;

      // Evitar datos nulos o manipulados desde herramientas como Postman
      if (!full_name || !email || !password) {
        return res.status(400).render('auth/register', {
          error: 'Todos los campos son obligatorios.'
        });
      }

      // Evitar cuentas duplicadas
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).render('auth/register', {
          error: 'Este correo electrónico ya está registrado.'
        });
      }

      // Criptografía
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      await User.create({
        full_name,
        email,
        password_hash,
        role: 'agricultor' 
      });

      // Se envía al login para que inicie sesión
      res.redirect('/login');

    } catch (error) {
      console.error('CRITICAL ERROR en authController.register:', error);
      res.status(500).render('auth/register', {
        error: 'Error interno del servidor. Por favor contacte al administrador.'
      });
    }
  },

 // DESTRUCCIÓN DE SESIÓN

  logout: (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      
      // Destruimos explícitamente la sesión de la memoria para que el gafete pierda validez
      req.session.destroy(() => {
        res.clearCookie('connect.sid'); // connect.sid es el nombre por defecto de la cookie de sesión
        res.redirect('/login');
      });
    });
  }
};
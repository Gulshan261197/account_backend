import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { User } from "../models/user.model.js";
import { IntroducerUser } from "../models/introducer.model.js"

import dotenv from "dotenv";
dotenv.config();

export const introducerUser = {
  
  createintroducerUser: async (data) => {
    const existingUser = await IntroducerUser.findOne({ email: data.email }).exec();
    if (existingUser) {
      throw { code: 409, message: `User already exists: ${data.email}` };
    }
  
    const passwordSalt = await bcrypt.genSalt();
    const encryptedPassword = await bcrypt.hash(data.password, passwordSalt);
    
    if (!data.firstname) {
      throw { code: 400, message: "Firstname is required" };
    }
    if (!data.lastname) {
      throw { code: 400, message: "Lastname is required" };
    }
    if (!data.email) {
      throw { code: 400, message: "Email is required" };
    }
    if (!data.password) {
      throw { code: 400, message: "Password is required" };
    }
  
    const newIntroducerUser = new IntroducerUser({
      firstname: data.firstname,
      lastname: data.lastname,
      email: data.email,
      password: encryptedPassword,
      roles: data.roles,
      introducerId: data.introducerId,
      introducerPercentage: data.introducerPercentage
    });
  
    newIntroducerUser.save().catch((err) => {
      console.error(err);
      throw { code: 500, message: "Failed to Save New Introducer User" };
    });
  
    return true;
  },

  
  findIntroducerUserById: async (id) => {
    if (!id) {
      throw { code: 409, message: "Required parameter: id" };
    }

    return IntroducerUser.findById(id).exec();
  },

  findIntroducerUser: async (filter) => {
    if (!filter) {
      throw { code: 409, message: "Required parameter: filter" };
    }
    return IntroducerUser.findOne(filter).exec();
  },

  generateIntroducerAccessToken: async (email, password, persist) => {
    if (!email) {
      throw { code: 400, message: "Invalid value for: email" };
    }
    if (!password) {
      throw { code: 400, message: "Invalid value for: password" };
    }

    const existingUser = await introducerUser.findIntroducerUser({ email: email });
    if (!existingUser) {
      throw { code: 401, message: "Invalid email address or password" };
    }

    const passwordValid = await bcrypt.compare(password, existingUser.password);
    if (!passwordValid) {
      throw { code: 401, message: "Invalid email address or password" };
    }

    const accessTokenResponse = {
      id: existingUser._id,
      name: existingUser.firstname,
      email: existingUser.email,
      role: existingUser.roles
    };
    console.log(accessTokenResponse);
    const accessToken = jwt.sign(
      accessTokenResponse,
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: persist ? "1y" : "8h",
      }
    );

    return {
      email: existingUser.email,
      accessToken: accessToken,
    };
  },


};
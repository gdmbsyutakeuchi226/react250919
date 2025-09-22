import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "my_super_secret_key";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if(req.method !== "POST"){
        return res.status(405).json({ message : "Method not allowed" });
    }
    const { email, password } = req.body;

    if(!email || !password ){
        return res.status(400).json({ message : "Missing field" });
    }

    try{
        // ユーザーを探す
        const user = await prisma.user.findUnique({ where : {email} });
        if(!user){
            return res.status(401).json({ message : "Invalid credentials" });
        }
        // パスワードを検証
        const isValid = await bcrypt.compare(password, user.password);
        if(!isValid){
            return res.status(401).json({ message : "Invalid credentials" });
        }
        // JWT発行
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "1h" });
        return res.status(200).json({ message: "Login successful", token });
    }catch(error: any){
        console.error("Login error:", error);
        return res.status(500).json({ message: "Error logging in", error: error.message });
    }
}
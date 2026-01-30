"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const { login, isLoading } = useAuthStore();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(username, password);
            toast.success("Login successful!");
            router.push("/chat");
        } catch (error: any) {
            const message = error.response?.data?.detail || error.message || "Invalid username or password";
            toast.error(message, {
                duration: 4000,
                icon: "❌",
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-app-bg p-4">
            {/* Background Glow */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-red/5 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-10"
            >
                <Card className="p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl mb-6 mx-auto overflow-hidden p-2">
                            <Image
                                src="/logo.png"
                                alt="Synerry Logo"
                                width={64}
                                height={64}
                                className="object-contain"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-app-text">Welcome Back</h1>
                        <p className="text-app-text-secondary mt-1">Sign in to your account</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                        />
                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                        <Button type="submit" className="w-full" isLoading={isLoading}>
                            Sign In
                        </Button>
                    </form>

                    {/* Register Link */}
                    <p className="text-center text-app-text-secondary mt-6">
                        Don't have an account?{" "}
                        <Link href="/register" className="text-brand-red hover:underline">
                            Sign up
                        </Link>
                    </p>
                </Card>
            </motion.div>
        </div>
    );
}

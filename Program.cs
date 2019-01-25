﻿using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ColocDuty
{
    class Program
    {
        static void Main(string[] args)
        {
            var ip = Environment.GetEnvironmentVariable("IP") ?? "0.0.0.0";
            if (!int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var port)) port = 80;
            var url = $"http://{ip}:{port}";

#if DEBUG
            var appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);
            string publicPath;

            var directory = Directory.GetParent(appPath);
            while (true)
            {
                publicPath = Path.Combine(directory.FullName, "Public");
                if (Directory.Exists(publicPath)) break;

                directory = directory.Parent;
            }
#else
            var appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);
            var publicPath = Path.Combine(appPath, "Public");
#endif

            var shutdownTokenSource = new CancellationTokenSource();
            var shutdownToken = shutdownTokenSource.Token;

            ConcurrentDictionary<string, ColocRoom> rooms = new ConcurrentDictionary<string, ColocRoom>();

            var roomTasks = new ConcurrentDictionary<Task, byte>();

            var builder = WebHost.CreateDefaultBuilder();
            builder.UseUrls(url);
            builder.ConfigureServices((services) => services.AddRouting());

            var roomCodeRandom = new Random();
            string GenerateRoomCode()
            {
                var code = "";
                for (var i = 0; i < 4; i++) code += (char)('A' + roomCodeRandom.Next(0, 26));
                return code;
            }

            string playHtml = "";
            void LoadPlayHtml() => playHtml = File.ReadAllText(Path.Combine(publicPath, "play.html"));
            LoadPlayHtml();

            builder.Configure((app) =>
            {
                app.UseWebSockets();
                app.Use(WebSocketMiddleware);

                app.UseRouter((router) =>
                {
                    router.MapGet("", (context) => { context.Response.Redirect("index.html"); return Task.CompletedTask; });

                    router.MapGet("start", (context) =>
                    {
                        var room = new ColocRoom(shutdownToken);

                        while (true)
                        {
                            room.Code = GenerateRoomCode();
                            if (rooms.TryAdd(room.Code, room)) break;
                        }

                        Task roomTask = null;

                        roomTask = Task.Run(() =>
                        {
                            room.Start();
                            roomTasks.TryRemove(roomTask, out _);
                            rooms.TryRemove(room.Code, out _);
                            return Task.CompletedTask;
                        });

                        roomTasks.TryAdd(roomTask, 0);
                        context.Response.Redirect("/play/" + room.Code);
                        return Task.CompletedTask;
                    });

                    router.MapGet("play/{code}", context =>
                    {
                        var roomCode = context.GetRouteValue("code");

#if DEBUG
                        LoadPlayHtml();
#endif

                        return context.Response.WriteAsync(playHtml);
                    });
                });

                app.UseStaticFiles(new StaticFileOptions
                {
                    RequestPath = "",
                    FileProvider = new PhysicalFileProvider(publicPath)
                });
            });

            using (var host = builder.Build())
            {
                host.Start();
                Console.WriteLine($"Server listening on {url}.");
                host.WaitForShutdown();
            }

            shutdownTokenSource.Cancel();
            Task.WaitAll(roomTasks.Keys.ToArray());

            async Task WebSocketMiddleware(HttpContext context, Func<Task> next)
            {
                if (!context.WebSockets.IsWebSocketRequest) { await next(); return; }
                if (!context.Request.Path.StartsWithSegments("/play", out var codeWithSlash)) { await next(); return; }

                var code = codeWithSlash.ToString().Substring(1);

                if (!rooms.TryGetValue(code, out var room))
                {
                    context.Response.StatusCode = 404;
                    return;
                }

                var originHeaders = context.Request.Headers["Origin"];

                if (originHeaders.Count != 1)
                {
                    context.Response.StatusCode = 400;
                    return;
                }

                ColocPeer peer = null;

                try
                {
                    using (var socket = await context.WebSockets.AcceptWebSocketAsync())
                    {
                        peer = new ColocPeer(socket);
                        room.AddPeer(peer);

                        WebSocketReceiveResult receiveResult;
                        var buffer = new byte[1024 * 16];
                        var segment = new ArraySegment<byte>(buffer);

                        while (!shutdownToken.IsCancellationRequested)
                        {
                            receiveResult = await socket.ReceiveAsync(segment, shutdownToken);

                            if (receiveResult.MessageType != WebSocketMessageType.Text) break;
                            if (!receiveResult.EndOfMessage) break;

                            string data;
                            try
                            {
                                data = Encoding.UTF8.GetString(buffer, 0, receiveResult.Count);
                            }
                            catch (Exception exception)
                            {
                                Console.WriteLine($"WebSocket received invalid UTF8 text.");
                                Console.WriteLine(exception);
                                return;
                            }

                            room.ReceiveMessage(peer, data);
                        }
                    }
                }
                catch (WebSocketException exception)
                {
                    Console.WriteLine($"WebSocket closed with error code {exception.WebSocketErrorCode}.");
                }
                finally
                {
                    if (peer != null) room.RemovePeer(peer);
                }
            }
        }
    }
}

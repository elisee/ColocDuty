using Microsoft.Collections.Extensions;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Json;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ColocDuty
{
    class ColocRoom
    {
        enum NetworkOutEventType { SendToPeer, KickPeer, End }

        class NetworkOutEvent
        {
            public NetworkOutEventType Type;
            public IReadOnlyList<ColocPeer> Peers;
            public string Data;
            public string KickReason;
        }

        enum NetworkInEventType { AddPeer, RemovePeer, ReceiveFromPeer }

        class NetworkInEvent
        {
            public NetworkInEventType Type;
            public ColocPeer Peer;
            public string Data;
        }


        public string Code;
        CancellationToken _shutdownToken;
        readonly BlockingCollection<NetworkOutEvent> _networkOutQueue = new BlockingCollection<NetworkOutEvent>();
        readonly ConcurrentQueue<NetworkInEvent> _networkInQueue = new ConcurrentQueue<NetworkInEvent>();

        Task _gameTask;

        public ColocRoom(CancellationToken shutdownToken)
        {
            _shutdownToken = shutdownToken;
        }

        public void Start()
        {
            _gameTask = Task.Run(() => RunLoop());

            var running = true;

            while (!_shutdownToken.IsCancellationRequested && running)
            {
                NetworkOutEvent outMessage;

                try
                {
                    outMessage = _networkOutQueue.Take(_shutdownToken);

                    var tasks = new Task[outMessage.Peers.Count];

                    switch (outMessage.Type)
                    {

                        case NetworkOutEventType.End:
                            running = false;
                            break;

                        case NetworkOutEventType.KickPeer:
                            for (var i = 0; i < outMessage.Peers.Count; i++) tasks[i] = outMessage.Peers[i].Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, outMessage.KickReason, _shutdownToken);
                            break;

                        case NetworkOutEventType.SendToPeer:
                            var bytes = Encoding.UTF8.GetBytes(outMessage.Data);
                            for (var i = 0; i < outMessage.Peers.Count; i++) tasks[i] = outMessage.Peers[i].Socket.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, cancellationToken: _shutdownToken);
                            break;
                    }

                    try
                    {
                        Task.WaitAll(tasks);
                    }
                    catch (Exception exception)
                    {
                        // Ignore, a socket must have been closed
                        Console.WriteLine("Exception while sending WebSocket message:");
                        Console.WriteLine(exception);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }

            _gameTask.Wait();
        }

        public void AddPeer(ColocPeer peer) => _networkInQueue.Enqueue(new NetworkInEvent { Type = NetworkInEventType.AddPeer, Peer = peer });
        public void RemovePeer(ColocPeer peer) => _networkInQueue.Enqueue(new NetworkInEvent { Type = NetworkInEventType.RemovePeer, Peer = peer });
        public void ReceiveMessage(ColocPeer peer, string data) => _networkInQueue.Enqueue(new NetworkInEvent { Type = NetworkInEventType.ReceiveFromPeer, Peer = peer, Data = data });

        void SendJSON(List<ColocPeer> peers, JsonObject data) => _networkOutQueue.Add(new NetworkOutEvent { Peers = peers.ToArray(), Data = data.ToString() });
        void SendJSON(ColocPeer peer, JsonObject data) => _networkOutQueue.Add(new NetworkOutEvent { Peers = new ColocPeer[] { peer }, Data = data.ToString() });

        void RunLoop()
        {
            var stopwatch = Stopwatch.StartNew();

            var peers = new List<ColocPeer>();
            var players = new OrderedDictionary<Guid, ColocPlayer>();

            var activePeers = new List<ColocPeer>();

            var isInGame = false;

            JsonObject MakeGameJson()
            {
                var jsonData = new JsonObject();

                var jsonPlayers = new JsonArray();
                jsonData.Add("players", jsonPlayers);
                foreach (var player in players.Values) jsonPlayers.Add(player.Username);

                jsonData.Add("state", MakeStateJson());

                return jsonData;
            }

            JsonObject MakeStateJson()
            {
                var jsonState = new JsonObject();
                jsonState.Add("name", isInGame ? "inGame" : "waiting");

                return jsonState;
            }

            void Kick(ColocPeer peer, string reason)
            {
                _networkOutQueue.Add(new NetworkOutEvent { Peers = new ColocPeer[] { peer }, KickReason = reason, Type = NetworkOutEventType.KickPeer });
            }

            void HandleMessage(ColocPeer peer, string type, JsonObject inJson)
            {
                switch (type)
                {
                    case "hello":
                        if (peer.Player != null) { Kick(peer, "Player already setup."); return; }

                        if (inJson.TryGetValue("viewerMode", out var jsonViewerMode))
                        {
                            peer.IsViewer = true;
                            activePeers.Add(peer);

                            var outJson = new JsonObject();
                            outJson.Add("type", "helloViewer");
                            outJson.Add("data", MakeGameJson());
                            SendJSON(peer, outJson);
                            return;
                        }

                        if (inJson.TryGetValue("guid", out var jsonGuid) &&
                        jsonGuid != null && jsonGuid.JsonType == JsonType.String &&
                        Guid.TryParse((string)jsonGuid, out var guid))
                        {
                            if (players.TryGetValue(guid, out var foundPlayer) && foundPlayer.Peer == null)
                            {
                                peer.Player = foundPlayer;
                                foundPlayer.Peer = peer;

                                var outJson = new JsonObject();
                                outJson.Add("type", "helloPlayer");
                                outJson.Add("guid", peer.Player.Guid.ToString());
                                outJson.Add("username", peer.Player.Username);
                                outJson.Add("data", MakeGameJson());
                                SendJSON(peer, outJson);
                                activePeers.Add(peer);

                                {
                                    var broadcastJson = new JsonObject();
                                    broadcastJson.Add("type", "addPlayer");
                                    broadcastJson.Add("username", peer.Player.Username);
                                    SendJSON(activePeers, broadcastJson);
                                }
                                return;
                            }
                        }

                        {
                            var outJson = new JsonObject();
                            outJson.Add("type", "plzJoin");
                            SendJSON(peer, outJson);
                        }

                        break;

                    case "joinAsPlayer":
                        if (peer.IsViewer) { Kick(peer, "Peer was setup as viewer."); return; }
                        if (peer.Player != null) { Kick(peer, "Player already setup."); return; }

                        if (!inJson.TryGetValue("username", out var jsonUsername) ||
                            jsonUsername == null ||
                            jsonUsername.JsonType != JsonType.String)
                        {
                            Kick(peer, "Username missing."); return;
                        }

                        var username = ((string)jsonUsername).Trim();
                        if (username.Length < 1 || username.Length > 20)
                        {
                            Kick(peer, "Username must be between 1 and 20 characters long."); return;
                        }

                        foreach (var player in players.Values)
                        {
                            if (player.Username == username)
                            {
                                Kick(peer, "There is already someone with this name.");
                                return;
                            }
                        }

                        peer.Player = new ColocPlayer(Guid.NewGuid(), (string)jsonUsername, peer);
                        players.Add(peer.Player.Guid, peer.Player);

                        {
                            var outJson = new JsonObject();
                            outJson.Add("type", "helloPlayer");
                            outJson.Add("guid", peer.Player.Guid.ToString());
                            outJson.Add("username", peer.Player.Username);
                            outJson.Add("data", MakeGameJson());
                            SendJSON(peer, outJson);
                            activePeers.Add(peer);
                        }

                        {
                            var broadcastJson = new JsonObject();
                            broadcastJson.Add("type", "addPlayer");
                            broadcastJson.Add("username", peer.Player.Username);
                            SendJSON(activePeers, broadcastJson);
                        }
                        break;

                    case "start":
                        if (peer.Player == null) { Kick(peer, "Can't start without a player."); return; }
                        if (players.Count < 2) { /* Ignored */ return; }

                        isInGame = true;

                        {
                            var broadcastJson = new JsonObject();
                            broadcastJson.Add("type", "setState");
                            broadcastJson.Add("state", MakeStateJson());
                            SendJSON(activePeers, broadcastJson);
                        }
                        break;
                }
            }

            while (!_shutdownToken.IsCancellationRequested)
            {
                while (_networkInQueue.TryDequeue(out var @event))
                {
                    switch (@event.Type)
                    {
                        case NetworkInEventType.AddPeer:
                            peers.Add(@event.Peer);
                            break;

                        case NetworkInEventType.ReceiveFromPeer:
                            JsonObject json;
                            string type;

                            try
                            {
                                json = (JsonObject)JsonValue.Parse(@event.Data);
                                type = (string)json["type"];
                            }
                            catch (Exception)
                            {
                                Kick(@event.Peer, "Invalid JSON");
                                continue;
                            }

                            HandleMessage(@event.Peer, type, json);
                            break;

                        case NetworkInEventType.RemovePeer:
                            peers.Remove(@event.Peer);
                            activePeers.Remove(@event.Peer);

                            var player = @event.Peer.Player;

                            if (player != null)
                            {
                                player.Peer = null;

                                if (!isInGame)
                                {
                                    players.Remove(player.Guid);

                                    var broadcastJson = new JsonObject();
                                    broadcastJson.Add("type", "removePlayer");
                                    broadcastJson.Add("username", player.Username);
                                    SendJSON(activePeers, broadcastJson);
                                }
                            }

#if !DEBUG
                            if (peers.Count == 0)
                            {
                                _networkOutQueue.Add(new NetworkOutEvent { Type = NetworkOutEventType.End, Peers = new ColocPeer[0] });
                                return;
                            }
#endif
                            break;
                    }
                }

                var deltaTime = stopwatch.Elapsed.TotalSeconds;
                stopwatch.Restart();
                Update(deltaTime);

                Thread.Sleep(1);
            }
        }

        void Update(double deltaTime)
        {

        }
    }
}

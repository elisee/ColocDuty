using ColocDuty.InGame;
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
    class Room
    {
        public const int MinPlayers = 2;
        public const int MaxPlayers = 6;

        public readonly OrderedDictionary<Guid, Player> Players = new OrderedDictionary<Guid, Player>();
        readonly List<Peer> _activePeers = new List<Peer>();

        enum NetworkOutEventType { SendToPeer, KickPeer, End }

        class NetworkOutEvent
        {
            public NetworkOutEventType Type;
            public IReadOnlyList<Peer> Peers;
            public string Data;
            public string KickReason;
        }

        enum NetworkInEventType { AddPeer, RemovePeer, ReceiveFromPeer }

        class NetworkInEvent
        {
            public NetworkInEventType Type;
            public Peer Peer;
            public string Data;
        }


        public string Code;
        CancellationToken _shutdownToken;
        readonly BlockingCollection<NetworkOutEvent> _networkOutQueue = new BlockingCollection<NetworkOutEvent>();
        readonly ConcurrentQueue<NetworkInEvent> _networkInQueue = new ConcurrentQueue<NetworkInEvent>();

        Task _gameTask;

        public Room(CancellationToken shutdownToken)
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

        public void AddPeer(Peer peer) => _networkInQueue.Enqueue(new NetworkInEvent { Type = NetworkInEventType.AddPeer, Peer = peer });
        public void RemovePeer(Peer peer) => _networkInQueue.Enqueue(new NetworkInEvent { Type = NetworkInEventType.RemovePeer, Peer = peer });
        public void ReceiveMessage(Peer peer, string data) => _networkInQueue.Enqueue(new NetworkInEvent { Type = NetworkInEventType.ReceiveFromPeer, Peer = peer, Data = data });

        public void SendJson(Peer peer, JsonObject data) => _networkOutQueue.Add(new NetworkOutEvent { Peers = new Peer[] { peer }, Data = data.ToString() });

        public void BroadcastJson(JsonObject data)
        {
            _networkOutQueue.Add(new NetworkOutEvent { Peers = _activePeers.ToArray(), Data = data.ToString() });
        }

        void RunLoop()
        {
            var stopwatch = Stopwatch.StartNew();

            var peers = new List<Peer>();
            Game game = null;

            JsonArray MakePlayersJson()
            {
                var jsonPlayers = new JsonArray();
                foreach (var player in Players.Values) jsonPlayers.Add(player.MakePublicJson());
                return jsonPlayers;
            }

            void Kick(Peer peer, string reason)
            {
                _networkOutQueue.Add(new NetworkOutEvent { Peers = new Peer[] { peer }, KickReason = reason, Type = NetworkOutEventType.KickPeer });
            }

            void HandleMessage(Peer peer, string type, JsonObject inJson)
            {
                switch (type)
                {
                    case "hello":
                        if (peer.Player != null) { Kick(peer, "Player already setup."); return; }

                        if (inJson.TryGetValue("viewerMode", out var jsonViewerMode))
                        {
                            peer.IsViewer = true;
                            _activePeers.Add(peer);

                            var outJson = new JsonObject();
                            outJson.Add("type", "hello");
                            outJson.Add("players", MakePlayersJson());
                            if (game != null) outJson.Add("game", game.MakeJson());
                            SendJson(peer, outJson);
                            return;
                        }

                        if (inJson.TryGetValue("guid", out var jsonGuid) &&
                        jsonGuid != null && jsonGuid.JsonType == JsonType.String &&
                        Guid.TryParse((string)jsonGuid, out var guid))
                        {
                            if (Players.TryGetValue(guid, out var foundPlayer) && foundPlayer.Peer == null)
                            {
                                peer.Player = foundPlayer;
                                foundPlayer.Peer = peer;

                                var outJson = new JsonObject();
                                outJson.Add("type", "hello");
                                outJson.Add("players", MakePlayersJson());
                                if (game != null) outJson.Add("game", game.MakeJson());
                                outJson.Add("selfPlayer", peer.Player.MakeSelfJson());
                                if (game != null) outJson.Add("selfGame", game.PlayerStates[peer.Player].MakeSelfJson());

                                SendJson(peer, outJson);
                                _activePeers.Add(peer);
                                return;
                            }
                        }

                        {
                            var outJson = new JsonObject();
                            outJson.Add("type", "whoDis");
                            SendJson(peer, outJson);
                        }

                        break;

                    case "joinAsPlayer":
                        if (peer.IsViewer) { Kick(peer, "Peer was setup as viewer."); return; }
                        if (peer.Player != null) { Kick(peer, "Player already setup."); return; }
                        if (Players.Count >= MaxPlayers) { Kick(peer, "Max players reached."); return; }
                        if (game != null) { Kick(peer, "Game is already in progress."); return; }

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

                        foreach (var player in Players.Values)
                        {
                            if (player.Username == username)
                            {
                                Kick(peer, "There is already someone with this name.");
                                return;
                            }
                        }

                        if (!inJson.TryGetValue("characterIndex", out var jsonCharacterIndex) ||
                            jsonCharacterIndex == null || jsonCharacterIndex.JsonType != JsonType.Number)
                        {
                            Kick(peer, "Character index missing."); return;
                        }

                        var characterIndex = (int)jsonCharacterIndex;

                        peer.Player = new Player(Guid.NewGuid(), username, characterIndex, peer);
                        Players.Add(peer.Player.Guid, peer.Player);

                        {
                            var outJson = new JsonObject();
                            outJson.Add("type", "hello");
                            outJson.Add("players", MakePlayersJson());
                            outJson.Add("selfPlayer", peer.Player.MakeSelfJson());
                            SendJson(peer, outJson);
                            _activePeers.Add(peer);
                        }

                        {
                            var broadcastJson = new JsonObject();
                            broadcastJson.Add("type", "addPlayer");
                            broadcastJson.Add("player", peer.Player.MakePublicJson());
                            BroadcastJson(broadcastJson);
                        }
                        break;

                    case "start":
                        if (peer.Player == null) { Kick(peer, "Can't start without a player."); return; }
#if !DEBUG
                        if (players.Count < MinPlayers) { /* Ignored */ return; }
#endif
                        if (game != null) return;

                        game = new Game(this);

                        var jsonGameState = game.MakeJson();

                        foreach (var activePeer in _activePeers)
                        {
                            var json = new JsonObject();
                            json.Add("type", "goInGame");
                            json.Add("game", jsonGameState);
                            if (activePeer.Player != null) json.Add("selfGame", game.PlayerStates[activePeer.Player].MakeSelfJson());

                            SendJson(activePeer, json);
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
                            _activePeers.Remove(@event.Peer);

                            var player = @event.Peer.Player;

                            if (player != null)
                            {
                                player.Peer = null;

                                if (game == null)
                                {
                                    Players.Remove(player.Guid);

                                    var broadcastJson = new JsonObject();
                                    broadcastJson.Add("type", "removePlayer");
                                    broadcastJson.Add("username", player.Username);
                                    BroadcastJson(broadcastJson);
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
                game?.Update(deltaTime);

                Thread.Sleep(1);
            }
        }
    }
}

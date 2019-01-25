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

        void SendJSON(List<ColocPeer> peers, string serializedData) => _networkOutQueue.Add(new NetworkOutEvent { Peers = peers.ToArray(), Data = serializedData });
        void SendJSON(ColocPeer peer, string serializedData) => _networkOutQueue.Add(new NetworkOutEvent  { Peers = new ColocPeer[] { peer }, Data = serializedData });

        void RunLoop()
        {
            var stopwatch = Stopwatch.StartNew();

            var peers = new List<ColocPeer>();

            while (!_shutdownToken.IsCancellationRequested)
            {
                while (_networkInQueue.TryDequeue(out var @event))
                {
                    switch (@event.Type)
                    {
                        case NetworkInEventType.AddPeer:
                            var obj = new JsonObject();
                            obj.Add("type", "setup");
                            obj.Add("mode", peers.Count == 0 ? "viewer" : "player");
                            SendJSON(@event.Peer, obj.ToString());

                            peers.Add(@event.Peer);
                            break;

                        case NetworkInEventType.RemovePeer:
                            peers.Remove(@event.Peer);

#if !DEBUG
                            if (peers.Count == 0)
                            {
                                _networkOutQueue.Add(new NetworkOutEvent { Type = NetworkOutEventType.End, Peers = new ColocPeer[0] });
                                return;
                            }
#endif
                            break;

                        case NetworkInEventType.ReceiveFromPeer:
                            Console.WriteLine("Peer:" + @event.Data);
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

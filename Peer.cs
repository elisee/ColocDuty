using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;

namespace ColocDuty
{
    class Peer
    {
        public readonly WebSocket Socket;
        public Player Player;
        public bool IsViewer;

        public Peer(WebSocket socket)
        {
            Socket = socket;
        }
    }
}

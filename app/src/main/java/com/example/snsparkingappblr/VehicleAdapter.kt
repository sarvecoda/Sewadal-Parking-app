package com.example.snsparkingappblr

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.snsparkingappblr.databinding.LiveVehicleFomatLooklikeBinding

class VehicleAdapter(
    private val items: MutableList<VehicleData>,
    private val listener: OnItemClickListener
) : RecyclerView.Adapter<VehicleAdapter.ViewHolder>() {

    init { setHasStableIds(true) }         // smoother animations

    /* ---------------------------------  View holder  --------------------------------- */

    class ViewHolder(private val binding: LiveVehicleFomatLooklikeBinding) :
        RecyclerView.ViewHolder(binding.root) {

        val row = binding.liveVehicleMain

        fun bind(vehicle: VehicleData, listener: OnItemClickListener) {
            binding.liveSlNoLookLike.text   = vehicle.id.toString()
            binding.liveNameLookLike.text   = vehicle.entry1
            binding.liveVehNoLookLike.text  = vehicle.entry2
            binding.liveMobileNoLookLike.text = vehicle.entry3
            binding.liveModelNameLookLike.text = vehicle.entry4

            binding.ivDelete.setOnClickListener {
                listener.deleteButtonOnClick(vehicle)
            }
            binding.liveMobileNoLookLike.setOnClickListener {
                listener.onCallButtonClick(binding.root.context, vehicle)
            }
        }
    }

    /* -------------------------------- Recycler stuff --------------------------------- */

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = LiveVehicleFomatLooklikeBinding
            .inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun getItemCount() = items.size

    override fun getItemId(position: Int): Long =
        items[position].entry2.hashCode().toLong()   // any unique value

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val vehicle = items[position]
        holder.bind(vehicle, listener)

        // alternating row colours
        val colourRes = if (position % 2 == 0) R.color.khakhi else R.color.skyblue
        holder.row.setBackgroundColor(
            ContextCompat.getColor(holder.itemView.context, colourRes)
        )
    }

    /* ---------------------------------  Helpers  ------------------------------------- */

    /** Replace the adapter’s backing list and refresh the rows. */
    fun update(newList: List<VehicleData>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }

    /* ---------------------------------  Contract  ------------------------------------ */

    interface OnItemClickListener {
        fun deleteButtonOnClick(vehicleData: VehicleData)
        fun onCallButtonClick(context: Context, vehicleData: VehicleData)
    }
}
